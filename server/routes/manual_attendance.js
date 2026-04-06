const express = require('express');
const { openDb } = require('../database');
const { authorizeRole } = require('../middleware/auth');
const { logHistory } = require('../utils/historyLogger');

const router = express.Router();

/**
 * GET /api/manual-attendance/preview
 * Fetch labour's previous balance (total advances) and last attendance record.
 * Used in the UI before saving a new manual entry.
 * Query params: labour_id
 */
router.get('/preview', authorizeRole(['admin']), async (req, res) => {
    const { labour_id } = req.query;
    if (!labour_id) {
        return res.status(400).json({ error: 'labour_id is required' });
    }

    try {
        const db = await openDb();

        // Total advance balance (all advances for this labour)
        const advancesResult = await db.get(
            `SELECT COALESCE(SUM(amount), 0) as total_advances FROM advances WHERE labour_id = ?`,
            [labour_id]
        );

        // Last attendance record (most recent)
        const lastAttendance = await db.get(
            `SELECT a.date, a.status, a.entry_mode, s.name as site_name
             FROM attendance a
             LEFT JOIN sites s ON a.site_id = s.id
             WHERE a.labour_id = ?
             ORDER BY a.date DESC
             LIMIT 1`,
            [labour_id]
        );

        // Labour basic info (name + rate)
        const labour = await db.get(
            `SELECT id, name, rate, phone, trade FROM labours WHERE id = ?`,
            [labour_id]
        );

        res.json({
            labour,
            total_advances: advancesResult?.total_advances || 0,
            last_attendance: lastAttendance || null,
        });
    } catch (err) {
        console.error('Error fetching manual preview:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/manual-attendance/check-duplicate
 * Check if an attendance record already exists for labour on a date.
 * Query params: labour_id, date
 */
router.get('/check-duplicate', authorizeRole(['admin']), async (req, res) => {
    const { labour_id, date } = req.query;
    if (!labour_id || !date) {
        return res.status(400).json({ error: 'labour_id and date are required' });
    }

    try {
        const db = await openDb();
        const existing = await db.get(
            `SELECT a.id, a.status, a.entry_mode, s.name as site_name
             FROM attendance a
             LEFT JOIN sites s ON a.site_id = s.id
             WHERE a.labour_id = ? AND a.date = ?`,
            [labour_id, date]
        );

        res.json({
            exists: !!existing,
            record: existing || null,
        });
    } catch (err) {
        console.error('Error checking duplicate:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/manual-attendance
 * Create or override an attendance record in MANUAL mode.
 * Skips labour-site validation — admin-only.
 * Body: { labour_id, site_id, date, status, allowance, overtime_amount,
 *          balance_adjustment, balance_type, manual_note, override_confirm }
 */
router.post('/', authorizeRole(['admin']), async (req, res) => {
    const {
        labour_id,
        site_id,
        date,
        status,
        allowance = 0,
        overtime_amount = 0,
        balance_adjustment = 0,
        balance_type = 'none',   // 'add' | 'deduct' | 'none'
        manual_note = null,
        override_confirm = false, // Client must explicitly confirm override
    } = req.body;

    // Validate required fields
    if (!labour_id || !site_id || !date || !status) {
        return res.status(400).json({ error: 'labour_id, site_id, date, and status are required' });
    }

    const validStatuses = ['full', 'half', 'absent'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const validBalanceTypes = ['add', 'deduct', 'none'];
    if (!validBalanceTypes.includes(balance_type)) {
        return res.status(400).json({ error: `balance_type must be one of: ${validBalanceTypes.join(', ')}` });
    }

    // Must not be a future date
    const [y, m, d] = date.split('-').map(Number);
    const reqDateLocal = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (reqDateLocal > today) {
        return res.status(400).json({ error: 'Cannot mark attendance for future dates.' });
    }

    try {
        const db = await openDb();

        // Check for existing record — if exists and not confirmed, warn
        const existing = await db.get(
            `SELECT id, entry_mode FROM attendance WHERE labour_id = ? AND date = ?`,
            [labour_id, date]
        );

        if (existing && !override_confirm) {
            return res.status(409).json({
                error: 'Attendance already exists for this labour on this date.',
                existing_mode: existing.entry_mode,
                requires_confirmation: true,
            });
        }

        const supervisor_id = req.user.id; // Admin acting as supervisor

        // Compute signed balance adjustment
        const signedBalance = balance_type === 'deduct'
            ? -Math.abs(balance_adjustment)
            : balance_type === 'add'
                ? Math.abs(balance_adjustment)
                : 0;

        if (existing) {
            // Override existing record
            await db.run(
                `UPDATE attendance
                 SET site_id = ?, supervisor_id = ?, status = ?,
                     entry_mode = 'manual',
                     allowance = ?, overtime_amount = ?,
                     balance_adjustment = ?, balance_type = ?,
                     manual_note = ?
                 WHERE labour_id = ? AND date = ?`,
                [site_id, supervisor_id, status,
                 allowance, overtime_amount,
                 signedBalance, balance_type,
                 manual_note,
                 labour_id, date]
            );
        } else {
            // Insert new manual record
            await db.run(
                `INSERT INTO attendance
                   (labour_id, site_id, supervisor_id, date, status,
                    entry_mode, allowance, overtime_amount,
                    balance_adjustment, balance_type, manual_note)
                 VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?)`,
                [labour_id, site_id, supervisor_id, date, status,
                 allowance, overtime_amount,
                 signedBalance, balance_type,
                 manual_note]
            );
        }

        // Fetch labour name for history log
        const labour = await db.get(`SELECT name FROM labours WHERE id = ?`, [labour_id]);
        const site = await db.get(`SELECT name FROM sites WHERE id = ?`, [site_id]);

        await logHistory({
            type: 'attendance',
            action: existing ? 'manual_override' : 'manual_entry',
            reference_id: labour_id,
            name: labour?.name || `Labour #${labour_id}`,
            metadata: {
                date, site: site?.name, status,
                allowance, overtime_amount,
                balance_adjustment: signedBalance, balance_type,
                manual_note, overrode: !!existing,
            },
            created_by: req.user?.id || null,
        });

        res.json({
            message: existing
                ? 'Manual attendance override saved successfully.'
                : 'Manual attendance entry saved successfully.',
        });
    } catch (err) {
        console.error('Error saving manual attendance:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/manual-attendance/history
 * Paginated history of manual attendance entries.
 * Query params: page, limit, labour_id, site_id, date_from, date_to
 */
router.get('/history', authorizeRole(['admin']), async (req, res) => {
    const { page = 1, limit = 20, labour_id, site_id, date_from, date_to } = req.query;

    try {
        const db = await openDb();

        const conditions = [`a.entry_mode = 'manual'`];
        const params = [];

        if (labour_id) {
            conditions.push('a.labour_id = ?');
            params.push(labour_id);
        }
        if (site_id) {
            conditions.push('a.site_id = ?');
            params.push(site_id);
        }
        if (date_from) {
            conditions.push('a.date >= ?');
            params.push(date_from);
        }
        if (date_to) {
            conditions.push('a.date <= ?');
            params.push(date_to);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (Number(page) - 1) * Number(limit);

        const records = await db.all(
            `SELECT
               a.id, a.date, a.status, a.entry_mode,
               a.allowance, a.overtime_amount,
               a.balance_adjustment, a.balance_type, a.manual_note,
               a.created_at,
               l.id as labour_id, l.name as labour_name, l.rate as labour_rate,
               s.id as site_id, s.name as site_name,
               u.name as recorded_by
             FROM attendance a
             LEFT JOIN labours l ON a.labour_id = l.id
             LEFT JOIN sites s ON a.site_id = s.id
             LEFT JOIN users u ON a.supervisor_id = u.id
             ${where}
             ORDER BY a.date DESC, a.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, Number(limit), offset]
        );

        const countResult = await db.get(
            `SELECT COUNT(*) as total FROM attendance a ${where}`,
            params
        );

        res.json({
            records,
            total: countResult?.total || 0,
            page: Number(page),
            limit: Number(limit),
        });
    } catch (err) {
        console.error('Error fetching manual history:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
