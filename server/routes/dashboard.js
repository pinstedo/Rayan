const express = require('express');
const { openDb } = require('../database');

const router = express.Router();

const { authorizeRole } = require('../middleware/auth');

router.get('/stats', authorizeRole(['admin', 'supervisor']), async (req, res) => {
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

router.get('/recent', authorizeRole(['admin', 'supervisor']), async (req, res) => {
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
