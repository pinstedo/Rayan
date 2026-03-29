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

        const recentLabours = await db.all('SELECT name, created_at, "labour" as type FROM labours ORDER BY created_at DESC LIMIT 5');
        const recentSites = await db.all('SELECT name, created_at, "site" as type FROM sites ORDER BY created_at DESC LIMIT 5');

        const allActivity = [...recentLabours, ...recentSites]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);

        const activities = allActivity.map(item => {
            if (item.type === 'labour') return `New labour added: ${item.name}`;
            if (item.type === 'site') return `New site created: ${item.name}`;
            return '';
        });

        res.json(activities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
