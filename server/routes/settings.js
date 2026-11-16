const express = require('express');
const { openDb } = require('../database');
const { authorizeRole } = require('../middleware/auth');
const { ROLES, ADMIN_OR_OWNER_ROLES } = require('../roles');
const { logHistory } = require('../utils/historyLogger');
const { getLabourDailyWage } = require('../utils/wages');

const router = express.Router();

const VIEW_ROLES = [ROLES.ADMIN, ROLES.OWNER, ROLES.SUPERVISOR, ROLES.SPECIAL_SUPERVISOR];
const MANAGE_ROLES = ADMIN_OR_OWNER_ROLES;

/**
 * GET /api/settings/food-allowance-rate
 * Returns the global food allowance rate (accessible by admin & supervisor).
 */
router.get('/food-allowance-rate', authorizeRole(VIEW_ROLES), async (req, res) => {
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
router.put('/food-allowance-rate', authorizeRole(MANAGE_ROLES), async (req, res) => {
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

/**
 * GET /api/settings/esi
 * Returns the global ESI percentage rate (accessible by authorized users).
 */
router.get('/esi', authorizeRole(VIEW_ROLES), async (req, res) => {
    try {
        const db = await openDb();
        const row = await db.get(`SELECT value FROM app_settings WHERE key = 'esi_percentage'`);
        const percentage = row ? parseFloat(row.value) : 0.75;
        res.json({ percentage: isNaN(percentage) ? 0.75 : percentage });
    } catch (err) {
        console.error('Error fetching ESI percentage:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/settings/esi
 * Admin/Owner: update the global ESI percentage.
 * Body: { percentage: number }
 */
router.put('/esi', authorizeRole(MANAGE_ROLES), async (req, res) => {
    const { percentage } = req.body;
    if (percentage === undefined || percentage === null || isNaN(Number(percentage)) || Number(percentage) < 0 || Number(percentage) > 100) {
        return res.status(400).json({ error: 'A valid ESI percentage between 0 and 100 is required.' });
    }
    try {
        const db = await openDb();
        const previousRow = await db.get(`SELECT value FROM app_settings WHERE key = 'esi_percentage'`);
        const oldPercentage = previousRow ? parseFloat(previousRow.value) : 0.75;
        const newPercentage = Number(percentage);

        await db.run(
            `INSERT INTO app_settings (key, value, updated_by, updated_at)
             VALUES ('esi_percentage', ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
            [String(newPercentage), req.user.id]
        );

        await logHistory({
            type: 'settings',
            action: 'esi_rate_updated',
            reference_id: null,
            name: 'ESI Rate',
            metadata: { old_percentage: oldPercentage, new_percentage: newPercentage },
            created_by: req.user ? req.user.id : null
        });

        res.json({ message: 'ESI percentage updated.', percentage: newPercentage });
    } catch (err) {
        console.error('Error updating ESI percentage:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/settings/esi/labours
 * Returns all labours with their ESI enrollment status and calculated daily deduction.
 */
router.get('/esi/labours', authorizeRole(VIEW_ROLES), async (req, res) => {
    try {
        const db = await openDb();
        const rateRow = await db.get(`SELECT value FROM app_settings WHERE key = 'esi_percentage'`);
        const esiPercentage = rateRow ? parseFloat(rateRow.value) : 0.75;

        const rows = await db.all(`
            SELECT l.id, l.name, l.phone, l.trade, l.site, l.site_id, l.daily_wage, l.rate, l.status,
                   COALESCE(l.esi_enabled, false) as esi_enabled,
                   s.name as site_name
            FROM labours l
            LEFT JOIN sites s ON l.site_id = s.id
            ORDER BY l.name ASC
        `);

        const labours = rows.map(l => {
            const dailyWage = getLabourDailyWage(l);
            const isEsi = Boolean(l.esi_enabled === true || l.esi_enabled === 't' || l.esi_enabled === 1 || l.esi_enabled === 'true');
            const dailyEsiAmount = dailyWage > 0 ? Number(((dailyWage * esiPercentage) / 100).toFixed(2)) : 0;
            return {
                id: l.id,
                name: l.name,
                phone: l.phone,
                trade: l.trade,
                site: l.site_name || l.site || (l.site_id ? `Site #${l.site_id}` : 'Unassigned'),
                site_id: l.site_id,
                status: l.status,
                daily_wage: dailyWage,
                esi_enabled: isEsi,
                daily_esi_amount: dailyEsiAmount
            };
        });

        res.json({
            esi_percentage: esiPercentage,
            labours
        });
    } catch (err) {
        console.error('Error fetching labours for ESI:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/settings/esi/bulk-assign
 * Admin/Owner: bulk update labours' ESI enrollment.
 * Body: { labour_ids: number[], esi_enabled: boolean }
 */
router.put('/esi/bulk-assign', authorizeRole(MANAGE_ROLES), async (req, res) => {
    const { labour_ids, esi_enabled } = req.body;
    if (!Array.isArray(labour_ids) || labour_ids.length === 0) {
        return res.status(400).json({ error: 'labour_ids must be a non-empty array of IDs.' });
    }
    if (typeof esi_enabled !== 'boolean') {
        return res.status(400).json({ error: 'esi_enabled must be a boolean.' });
    }

    try {
        const db = await openDb();
        const placeholders = labour_ids.map(() => '?').join(',');
        await db.run(
            `UPDATE labours SET esi_enabled = ? WHERE id IN (${placeholders})`,
            [esi_enabled, ...labour_ids]
        );

        await logHistory({
            type: 'labour',
            action: esi_enabled ? 'esi_enrolled_bulk' : 'esi_unenrolled_bulk',
            reference_id: null,
            name: `${labour_ids.length} labours`,
            metadata: { count: labour_ids.length, labour_ids, esi_enabled },
            created_by: req.user ? req.user.id : null
        });

        res.json({
            message: `Successfully updated ESI status for ${labour_ids.length} labour(s).`,
            count: labour_ids.length,
            esi_enabled
        });
    } catch (err) {
        console.error('Error in bulk ESI assignment:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
