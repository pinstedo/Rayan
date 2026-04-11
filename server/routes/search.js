const express = require('express');
const router = express.Router();
const { openDb } = require('../database');

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

        let results = [];

        // Search labours
        if (!type || type === 'labour') {
            const labours = await db.all(
                `SELECT id, name, phone, profile_image, 'labour' as type 
                 FROM labours 
                 WHERE name LIKE ? OR phone LIKE ?
                 ORDER BY name ASC LIMIT ? OFFSET ?`,
                [searchTerm, searchTerm, l, o]
            );
            results = results.concat(labours);
        }

        // Search sites
        if (!type || type === 'site') {
            const sites = await db.all(
                `SELECT id, name, address, description, 'site' as type 
                 FROM sites 
                 WHERE name LIKE ? OR address LIKE ? OR description LIKE ?
                 ORDER BY name ASC LIMIT ? OFFSET ?`,
                [searchTerm, searchTerm, searchTerm, l, o]
            );
            results = results.concat(sites);
        }

        // Search users (supervisors)
        if (!type || type === 'user' || type === 'supervisor') {
            const users = await db.all(
                `SELECT id, name, phone, role, profile_image, 'user' as type 
                 FROM users 
                 WHERE name LIKE ? OR phone LIKE ?
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
