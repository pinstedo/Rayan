const express = require('express');
const { openDb } = require('../database');
const { authorizeRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/settings/food-allowance-rate
 * Returns the global food allowance rate (accessible by admin & supervisor).
 */
router.get('/food-allowance-rate', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const row = await db.get(`SELECT value FROM app_settings WHERE key = 'food_allowance_rate'`);
        res.json({ rate: row ? parseFloat(row.value) : 70 });
    } catch (err) {
        console.error('Error fetching food allowance rate:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/settings/food-allowance-rate
 * Admin-only: update the global food allowance rate.
 * Body: { rate: number }
 */
router.put('/food-allowance-rate', authorizeRole(['admin']), async (req, res) => {
    const { rate } = req.body;
    if (rate === undefined || rate === null || isNaN(Number(rate)) || Number(rate) < 0) {
        return res.status(400).json({ error: 'A valid non-negative rate is required.' });
    }
    try {
        const db = await openDb();
        await db.run(
            `INSERT INTO app_settings (key, value, updated_by, updated_at)
             VALUES ('food_allowance_rate', ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
            [String(Number(rate)), req.user.id]
        );
        res.json({ message: 'Food allowance rate updated.', rate: Number(rate) });
    } catch (err) {
        console.error('Error updating food allowance rate:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
