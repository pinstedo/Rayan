const express = require('express');
const { openDb } = require('../database');

const router = express.Router();

const { authorizeRole } = require('../middleware/auth');
const { FIELD_SUPERVISOR_ROLES, OWNER_ROLES } = require('../roles');

router.get('/stats', authorizeRole(FIELD_SUPERVISOR_ROLES), async (req, res) => {
    try {
        const db = await openDb();

        const workersCount = await db.get("SELECT COUNT(*) as count FROM labours WHERE status NOT IN ('terminated', 'blacklisted')");
        const activeWorkersCount = await db.get("SELECT COUNT(*) as count FROM labours WHERE site_id IS NOT NULL AND status = 'active'");
        const sitesCount = await db.get('SELECT COUNT(*) as count FROM sites');

        // Get today's date in YYYY-MM-DD format to match attendance records
        const today = new Date().toISOString().split('T')[0];

        const presentCount = await db.get(
            `SELECT COUNT(*) as count FROM attendance 
             WHERE date = ? AND status IN ('full', 'half')`,
            [today]
        );

        res.json({
            workers: workersCount.count,
            jobs: activeWorkersCount.count,
            attendance: presentCount.count,
            approvals: sitesCount.count
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/owner-daily', authorizeRole(OWNER_ROLES), async (req, res) => {
    try {
        const db = await openDb();
        const date = req.query.date || new Date().toISOString().split('T')[0];

        const siteRows = await db.all(`
            SELECT
                s.id,
                s.name,
                s.address,
                COALESCE(
                  (SELECT sh.status FROM site_status_history sh 
                   WHERE sh.site_id = s.id 
                     AND sh.from_date <= ? 
                     AND (sh.to_date IS NULL OR sh.to_date >= ?)
                   ORDER BY sh.from_date DESC LIMIT 1),
                  s.status
                ) as status,
                s.completion_percentage,
                COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) as active_labour_count,
                COUNT(DISTINCT l.id) as total_labour_count,
                COUNT(DISTINCT CASE WHEN a.status = 'full' THEN a.labour_id END) as full_count,
                COUNT(DISTINCT CASE WHEN a.status = 'half' THEN a.labour_id END) as half_count,
                COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.labour_id END) as absent_marked_count,
                COUNT(DISTINCT a.labour_id) as total_marked
            FROM sites s
            LEFT JOIN labours l ON l.site_id = s.id
            LEFT JOIN attendance a ON a.site_id = s.id AND a.date = ?
            GROUP BY s.id
            ORDER BY s.name ASC
        `, [date, date, date]);

        const advanceRows = await db.all(`
            SELECT
                COALESCE(s.id, 0) as site_id,
                COALESCE(s.name, 'Unassigned') as site_name,
                COUNT(a.id) as count,
                COALESCE(SUM(a.amount), 0) as total_amount
            FROM advances a
            JOIN labours l ON a.labour_id = l.id
            LEFT JOIN sites s ON l.site_id = s.id
            WHERE a.date = ?
            GROUP BY s.id, s.name
            ORDER BY site_name ASC
        `, [date]);

        const siteStatusSummary = await db.all(`
            SELECT status, COUNT(*) as count
            FROM (
                SELECT 
                    COALESCE(
                      (SELECT sh.status FROM site_status_history sh 
                       WHERE sh.site_id = s.id 
                         AND sh.from_date <= ? 
                         AND (sh.to_date IS NULL OR sh.to_date >= ?)
                       ORDER BY sh.from_date DESC LIMIT 1),
                      s.status
                    ) as status
                FROM sites s
            ) t
            GROUP BY status
        `, [date, date]);

        const totals = siteRows.reduce((acc, site) => {
            const full = Number(site.full_count) || 0;
            const half = Number(site.half_count) || 0;
            const present = full + half;
            const activeLabours = Number(site.active_labour_count) || 0;
            const absentMarked = Number(site.absent_marked_count) || 0;
            acc.present += present;
            acc.totalMarked += Number(site.total_marked) || 0;
            acc.totalLabours += Number(site.total_labour_count) || 0;
            acc.activeLabours += activeLabours;
            acc.computedAbsent += Math.max(absentMarked, Math.max(0, activeLabours - present));
            return acc;
        }, { present: 0, totalMarked: 0, totalLabours: 0, activeLabours: 0, computedAbsent: 0 });

        const advancesTotal = advanceRows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
        const advancesCount = advanceRows.reduce((sum, row) => sum + Number(row.count || 0), 0);

        const statusCounts = siteStatusSummary.reduce((acc, row) => {
            acc[row.status] = Number(row.count) || 0;
            return acc;
        }, {});

        res.json({
            date,
            summary: {
                present: totals.present,
                computedAbsent: totals.computedAbsent,
                totalMarked: totals.totalMarked,
                totalLabours: totals.totalLabours,
                activeLabours: totals.activeLabours,
                totalAdvances: advancesTotal,
                advanceCount: advancesCount,
                totalSites: siteRows.length,
                activeSites: statusCounts.active || 0,
                inactiveSites: statusCounts.inactive || 0,
                completedSites: statusCounts.completed || 0,
            },
            sites: siteRows.map(site => {
                const full = Number(site.full_count) || 0;
                const half = Number(site.half_count) || 0;
                const present = full + half;
                const activeLabours = Number(site.active_labour_count) || 0;
                const absentMarked = Number(site.absent_marked_count) || 0;
                return {
                    ...site,
                    active_labour_count: activeLabours,
                    total_labour_count: Number(site.total_labour_count) || 0,
                    full_count: full,
                    half_count: half,
                    present_count: present,
                    absent_marked_count: absentMarked,
                    computed_absent_count: Math.max(absentMarked, Math.max(0, activeLabours - present)),
                    total_marked: Number(site.total_marked) || 0,
                };
            }),
            advancesBySite: advanceRows.map(row => ({
                site_id: Number(row.site_id) || null,
                site_name: row.site_name,
                count: Number(row.count) || 0,
                total_amount: Number(row.total_amount) || 0,
            })),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/recent', authorizeRole(FIELD_SUPERVISOR_ROLES), async (req, res) => {
    try {
        const db = await openDb();

        const logs = await db.all(`
            SELECT h.*, u.name as user_name 
            FROM history_logs h
            LEFT JOIN users u ON h.created_by = u.id
            ORDER BY h.created_at DESC 
            LIMIT 15
        `);

        const formatActionName = (action) => action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        const activities = logs.map(item => {
            const actionFormatted = formatActionName(item.action);
            const typeFormatted = item.type.charAt(0).toUpperCase() + item.type.slice(1);
            let text = `${typeFormatted} ${actionFormatted}`;
            if (item.name) text += `: ${item.name}`;
            
            // Format time safely
            let timeStr = '';
            try {
                const date = new Date(item.created_at);
                timeStr = date.toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                });
            } catch (e) {
                // Fallback
            }
            
            return `${text} • ${timeStr}`;
        });

        res.json(activities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
