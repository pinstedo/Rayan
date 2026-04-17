const express = require('express');
const { openDb } = require('../database');

const router = express.Router();

const { authorizeRole } = require('../middleware/auth');
const { logHistory } = require('../utils/historyLogger');

// Get attendance for a specific site and date, or all sites if site_id is missing
router.post('/fetch', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { site_id, date } = req.body;

    if (!date) {
        return res.status(400).json({ error: 'Date is required' });
    }

    try {
        const db = await openDb();
        let query = 'SELECT id, labour_id, site_id, supervisor_id, date, status, food_allowance, allowance as food_allowance_amount, entry_mode, created_at FROM attendance WHERE date = ?';
        const params = [date];

        if (site_id) {
            query += ' AND site_id = ?';
            params.push(site_id);
        }

        const attendance = await db.all(query, params);
        res.json(attendance);
    } catch (err) {
        console.error("Error fetching attendance:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get own attendance (for logged in labour)
router.get('/my-attendance', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'labour') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const db = await openDb();
        // Get all attendance records for this labour
        const attendance = await db.all(
            `SELECT a.*, s.name as site_name, u.name as supervisor_name
            FROM attendance a 
            JOIN sites s ON a.site_id = s.id 
            LEFT JOIN users u ON a.supervisor_id = u.id
            WHERE a.labour_id = ? 
            ORDER BY a.date DESC`,
            [req.user.id]
        );
        res.json(attendance);
    } catch (err) {
        console.error("Error fetching my attendance:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get attendance summary (marked dates) for a site and month
router.post('/summary', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { site_id, month, year } = req.body;

    if (!site_id || !month || !year) {
        return res.status(400).json({ error: 'Site ID, month, and year are required' });
    }

    try {
        const db = await openDb();
        // Format month to 2 digits
        const monthStr = month.toString().padStart(2, '0');

        // Find dates where attendance exists for this site
        // We look at the daily_site_attendance_status table for locked/submitted days
        // Or we could look at the attendance table directly. 
        // Using attendance table is safer if lock isn't always present, 
        // but lock table is more authoritative for "submission".
        // Let's use attendance table distinct dates to be sure we catch any data.

        const rows = await db.all(
            `SELECT DISTINCT date FROM attendance 
             WHERE site_id = ? AND TO_CHAR(CAST(date AS DATE), 'MM') = ? AND TO_CHAR(CAST(date AS DATE), 'YYYY') = ?`,
            [site_id, monthStr, year.toString()]
        );

        const dates = rows.map(r => r.date);
        res.json({ dates });
    } catch (err) {
        console.error("Error fetching attendance summary:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get lock status for a specific site and date
router.post('/lock-status', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { site_id, date } = req.body;

    if (!site_id || !date) {
        return res.status(400).json({ error: 'Site ID and date are required' });
    }

    try {
        const db = await openDb();
        const status = await db.get(
            `SELECT is_locked, food_provided FROM daily_site_attendance_status WHERE site_id = ? AND date = ?`,
            [site_id, date]
        );
        res.json({
            is_locked: status ? !!status.is_locked : false,
            food_provided: status ? !!status.food_provided : false
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark attendance (batch or single)
router.post('/', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { records, food_provided } = req.body;
    // records should be an array of { labour_id, site_id, supervisor_id, date, status }

    if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'Invalid attendance records' });
    }

    // Check if locked
    const firstRecord = records[0];
    const { site_id, date } = firstRecord;

    // Validate that date is not in the future
    const recordDate = new Date(date);
    const today = new Date();
    // Reset time part of today to ensure we only compare dates
    today.setHours(0, 0, 0, 0);
    // records are YYYY-MM-DD, so new Date(date) is UTC midnight usually, 
    // but better to compare string directly or careful with timezones.
    // "2023-10-27" -> UTC midnight. 
    // new Date() -> Local time.
    // Let's rely on string comparison for YYYY-MM-DD if we are sure about format, 
    // OR create a local date from the string.

    // Simplest robust way: 
    // Create a date object from the input string (which is UTC midnight)
    // Create a date object for "now"
    // But we need to be careful about the "current day" definition.
    // If server is UTC and specific timezone is needed...
    // Assuming server local time is the source of truth as per instructions.

    const requestDate = new Date(date);
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // We need to parse YYYY-MM-DD correctly in local time context to compare with today local
    const [y, m, d] = date.split('-').map(Number);
    const reqDateLocal = new Date(y, m - 1, d);

    if (reqDateLocal > currentDate) {
        return res.status(400).json({ error: 'Cannot mark attendance for future dates.' });
    }

    let db;
    try {
        db = await openDb();

        const lockStatus = await db.get(
            `SELECT is_locked FROM daily_site_attendance_status WHERE site_id = ? AND date = ?`,
            [site_id, date]
        );

        if (lockStatus && lockStatus.is_locked) {
            const isAdmin = req.user && req.user.role === 'admin';
            const isToday = reqDateLocal.getTime() === currentDate.getTime();

            if (!isAdmin) {
                return res.status(403).json({ error: 'Attendance for this date is locked and cannot be modified by supervisors.' });
            }
        }

        const labourIds = records.map(r => r.labour_id);
        const qMarks = labourIds.map(() => '?').join(',');
        const laboursData = await db.all(`SELECT id, status, site_id FROM labours WHERE id IN (${qMarks})`, labourIds);
        
        const laboursMap = new Map();
        laboursData.forEach(l => laboursMap.set(l.id, l));

        // Use a transaction for batch inserts/updates
        await db.exec('BEGIN TRANSACTION');

        const stmt = await db.prepare(
            `INSERT INTO attendance (labour_id, site_id, supervisor_id, date, status, food_allowance, allowance, labour_status, site_id_snapshot) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(labour_id, date) DO UPDATE SET status = excluded.status,
               food_allowance = excluded.food_allowance, allowance = excluded.allowance,
               labour_status = excluded.labour_status, site_id_snapshot = excluded.site_id_snapshot`
        );

        let supervisor_id_to_lock = null;

        for (const record of records) {
            const { labour_id, site_id: r_site_id, supervisor_id, date: r_date, status,
                    food_allowance = false, food_allowance_amount = 0 } = record;
            if (!labour_id || !r_site_id || !supervisor_id || !r_date || !status) {
                throw new Error('Missing fields in attendance record');
            }
            if (r_site_id !== site_id || r_date !== date) {
                throw new Error('All records must be for the same site and date');
            }

            const labour = laboursMap.get(labour_id);
            if (!labour) throw new Error(`Labour (ID: ${labour_id}) not found`);

            if (labour.status !== 'active') {
                throw new Error(`Labour (ID: ${labour_id}) is not active`);
            }
            if (labour.site_id !== site_id) {
                throw new Error(`Labour (ID: ${labour_id}) is not assigned to this site`);
            }

            supervisor_id_to_lock = supervisor_id;
            await stmt.run(labour_id, r_site_id, supervisor_id, r_date, status,
                           !!food_allowance, food_allowance ? Number(food_allowance_amount) || 0 : 0,
                           labour.status, labour.site_id);
        }

        await stmt.finalize();

        // Lock the attendance for this day
        if (supervisor_id_to_lock) {
            await db.run(
                `INSERT INTO daily_site_attendance_status (site_id, date, is_locked, food_provided, submitted_by)
                 VALUES (?, ?, true, ?, ?)
                 ON CONFLICT(site_id, date) DO UPDATE SET is_locked = true, food_provided = excluded.food_provided, submitted_by = excluded.submitted_by, submitted_at = CURRENT_TIMESTAMP`,
                [site_id, date, (food_provided === true || food_provided === 'true'), supervisor_id_to_lock]
            );
        }

        await db.exec('COMMIT');
        
        await logHistory({
            type: 'attendance',
            action: 'marked',
            reference_id: site_id,
            name: `Attendance for Site ${site_id} (${date})`,
            metadata: { records_count: records.length, date, food_provided: !!food_provided },
            created_by: req.user ? req.user.id : null
        });

        res.json({ message: 'Attendance marked successfully' });
    } catch (err) {
        // Rollback on error
        if (db) {
            await db.exec('ROLLBACK');
        }
        res.status(500).json({ error: err.message });
    }
});

// Get all attendance records for a specific labour
router.get('/labour/:id', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const records = await db.all(
            `SELECT a.id, a.date, a.status, a.created_at,
                    a.food_allowance, a.allowance as food_allowance_amount,
                    s.id as site_id, s.name as site_name
             FROM attendance a
             LEFT JOIN sites s ON a.site_id = s.id
             WHERE a.labour_id = ?
             ORDER BY a.date DESC
             LIMIT 100`,
            [req.params.id]
        );
        res.json(records);
    } catch (err) {
        console.error('Error fetching labour attendance:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

