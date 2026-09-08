const express = require('express');
const { openDb } = require('../database');
const { getApplicableHourlyRate } = require('../utils/wages');

const router = express.Router();

// Get overtime for a specific date and site (optional)
router.post('/fetch', async (req, res) => {
    const { date, site_id } = req.body;

    if (!date) {
        return res.status(400).json({ error: 'Date is required' });
    }

    try {
        const db = await openDb();
        let query = `
            SELECT o.*, l.name as labour_name, l.trade as labour_role 
            FROM overtime o 
            JOIN labours l ON o.labour_id = l.id 
            WHERE o.date = ?
        `;
        const params = [date];

        if (site_id) {
            query += ' AND o.site_id = ?';
            params.push(site_id);
        }

        const overtimeRecords = await db.all(query, params);
        res.json(overtimeRecords);
    } catch (err) {
        console.error("Error fetching overtime:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Add or Update overtime record (Bulk or Single)
router.post('/', async (req, res) => {
    const db = await openDb();

    // Normalize input to array
    const records = Array.isArray(req.body) ? req.body : [req.body];

    if (records.length === 0) {
        return res.status(400).json({ error: 'No records provided' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        const labourIds = [...new Set(records.map(r => r.labour_id).filter(Boolean))];
        const labourMap = new Map();
        const histMap = new Map();

        if (labourIds.length > 0) {
            const placeholders = labourIds.map(() => '?').join(',');
            const labours = await db.all(`SELECT id, rate, daily_wage FROM labours WHERE id IN (${placeholders})`, labourIds);
            labours.forEach(l => labourMap.set(l.id, l));

            const allHistory = await db.all(
                `SELECT labour_id, previous_rate, new_rate, previous_daily_wage, new_daily_wage, date FROM salary_history WHERE labour_id IN (${placeholders}) ORDER BY date ASC`,
                labourIds
            );
            allHistory.forEach(h => {
                if (!histMap.has(h.labour_id)) histMap.set(h.labour_id, []);
                histMap.get(h.labour_id).push(h);
            });
        }

        for (const record of records) {
            const { labour_id, site_id, date, hours, amount, notes, created_by } = record;

            if (!labour_id || !site_id || !date || hours === undefined) {
                throw new Error(`Missing required fields for labour_id: ${labour_id}`);
            }

            const labour = labourMap.get(labour_id);
            const history = histMap.get(labour_id) || [];
            let computedAmount;
            if (labour) {
                const hourlyRate = getApplicableHourlyRate(labour, history, date);
                computedAmount = (Number(hours) || 0) * hourlyRate;
            } else {
                computedAmount = Number(amount) || 0;
            }

            // Check if record exists
            const existing = await db.get(
                'SELECT id FROM overtime WHERE labour_id = ? AND date = ?',
                [labour_id, date]
            );

            if (existing) {
                // Update
                await db.run(
                    `UPDATE overtime 
                     SET hours = ?, amount = ?, notes = ?, site_id = ? 
                     WHERE id = ?`,
                    [hours, computedAmount, notes, site_id, existing.id]
                );
            } else {
                // Insert
                await db.run(
                    `INSERT INTO overtime (labour_id, site_id, date, hours, amount, notes, created_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [labour_id, site_id, date, hours, computedAmount, notes, created_by]
                );
            }
        }

        await db.run('COMMIT');
        res.json({ message: 'Overtime records saved successfully', count: records.length });

    } catch (err) {
        await db.run('ROLLBACK');
        console.error("Error saving overtime:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get all overtime records for a specific labour
router.get('/labour/:id', async (req, res) => {
    try {
        const db = await openDb();
        const records = await db.all(
            `SELECT o.id, o.date, o.hours, o.amount, o.notes, o.created_at,
                    s.id as site_id, s.name as site_name
             FROM overtime o
             LEFT JOIN sites s ON o.site_id = s.id
             WHERE o.labour_id = ?
             ORDER BY o.date DESC
             LIMIT 100`,
            [req.params.id]
        );
        res.json(records);
    } catch (err) {
        console.error('Error fetching labour overtime:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

