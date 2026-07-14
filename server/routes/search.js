const express = require('express');
const router = express.Router();
const { openDb } = require('../database');

const ADMIN_SCREENS = [
    { id: 'add-labour', name: 'Add Labour', route: '/(screens)/add-labour', type: 'screen' },
    { id: 'add-site', name: 'Add Site', route: '/(screens)/add-site', type: 'screen' },
    { id: 'add-supervisor', name: 'Add Supervisor', route: '/(screens)/add-supervisor', type: 'screen' },
    { id: 'labours', name: 'Manage Labours', route: '/(screens)/labours', type: 'screen' },
    { id: 'sites', name: 'Manage Sites', route: '/(screens)/sites', type: 'screen' },
    { id: 'supervisors', name: 'Manage Supervisors', route: '/(screens)/supervisors', type: 'screen' },
    { id: 'wage-report', name: 'Wage Report', route: '/(screens)/reports/wage-report', type: 'screen' },
    { id: 'bonus-report', name: 'Bonus & Increment Report', route: '/(screens)/reports/bonus-attendance-report', type: 'screen' },
    { id: 'site-attendance-report', name: 'Site Attendance Report', route: '/(screens)/reports/site-attendance', type: 'screen' },
    { id: 'attendance', name: 'Mark Attendance', route: '/(screens)/attendance', type: 'screen' },
    { id: 'completed-sites', name: 'Completed Sites', route: '/(screens)/completed-sites', type: 'screen' },
    { id: 'pending-admins', name: 'Pending Admin Approvals', route: '/(screens)/pending-admins', type: 'screen' },
    { id: 'supervisor-bin', name: 'Supervisor Bin (Deleted)', route: '/(screens)/supervisor-bin', type: 'screen' },
    { id: 'history-logs', name: 'History Logs / Audit Trail', route: '/(screens)/settings/history', type: 'screen' },
    { id: 'advances', name: 'Advances & Payments', route: '/(screens)/advance', type: 'screen' },
    { id: 'overtime', name: 'Overtime Logs', route: '/(screens)/overtime', type: 'screen' },
    { id: 'settings', name: 'App Settings / Profile', route: '/(tabs)/profile', type: 'screen' },
];

router.post('/', async (req, res) => {
    try {
        const { q, type, limit = 20, offset = 0 } = req.body;
        if (!q || q.trim() === '') {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const db = await openDb();
        const searchTerm = `%${q.trim()}%`;
        const l = parseInt(limit);
        const o = parseInt(offset);
        const isAdmin = req.user && req.user.role === 'admin';

        let results = [];

        // 1. Search screens / features (Admin only)
        if (isAdmin && (!type || type === 'screen')) {
            const queryLower = q.toLowerCase().trim();
            const matchedScreens = ADMIN_SCREENS.filter(s => 
                s.name.toLowerCase().includes(queryLower)
            );
            results = results.concat(matchedScreens);
        }

        // 2. Search labours
        if (!type || type === 'labour') {
            let labours;
            if (isAdmin) {
                // Admins can search name, phone, trade, aadhaar, site
                labours = await db.all(
                    `SELECT id, name, phone, trade, aadhaar, site, profile_image, 'labour' as type 
                     FROM labours 
                     WHERE name ILIKE ? OR phone ILIKE ? OR trade ILIKE ? OR aadhaar ILIKE ? OR site ILIKE ?
                     ORDER BY name ASC LIMIT ? OFFSET ?`,
                    [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, l, o]
                );
            } else {
                // Non-admins can only search name and phone
                labours = await db.all(
                    `SELECT id, name, phone, profile_image, 'labour' as type 
                     FROM labours 
                     WHERE name ILIKE ? OR phone ILIKE ?
                     ORDER BY name ASC LIMIT ? OFFSET ?`,
                    [searchTerm, searchTerm, l, o]
                );
            }
            results = results.concat(labours);
        }

        // 3. Search sites
        if (!type || type === 'site') {
            const sites = await db.all(
                `SELECT id, name, address, description, 'site' as type 
                 FROM sites 
                 WHERE name ILIKE ? OR address ILIKE ? OR description ILIKE ?
                 ORDER BY name ASC LIMIT ? OFFSET ?`,
                [searchTerm, searchTerm, searchTerm, l, o]
            );
            results = results.concat(sites);
        }

        // 4. Search users (supervisors)
        if (!type || type === 'user' || type === 'supervisor') {
            const users = await db.all(
                `SELECT id, name, phone, role, profile_image, 'user' as type 
                 FROM users 
                 WHERE name ILIKE ? OR phone ILIKE ?
                 ORDER BY name ASC LIMIT ? OFFSET ?`,
                [searchTerm, searchTerm, l, o]
            );
            results = results.concat(users);
        }

        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
