const express = require('express');
const { openDb } = require('../database');

const router = express.Router();

const { authorizeRole } = require('../middleware/auth');

// List all sites
router.get('/', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const sites = await db.all(`
            SELECT 
                s.*,
                COUNT(DISTINCT ss.supervisor_id) as supervisor_count,
                COUNT(DISTINCT l.id) as labour_count
            FROM sites s
            LEFT JOIN site_supervisors ss ON s.id = ss.site_id
            LEFT JOIN labours l ON s.id = l.site_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
        `);
        res.json(sites);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get sites assigned to a supervisor - MUST be before /:id route
router.get('/supervisor/:supervisorId', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const sites = await db.all(`
            SELECT s.*, ss.assigned_at
            FROM sites s
            JOIN site_supervisors ss ON s.id = ss.site_id
            WHERE ss.supervisor_id = ?
            ORDER BY ss.assigned_at DESC
        `, [req.params.supervisorId]);
        res.json(sites);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new site
router.post('/', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { name, address, description, created_by } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Site name is required' });
    }

    try {
        const db = await openDb();
        const result = await db.run(
            `INSERT INTO sites (name, address, description, created_by) VALUES (?, ?, ?, ?) RETURNING id`,
            [name, address, description, created_by]
        );

        const newSite = await db.get(`SELECT * FROM sites WHERE id = ?`, [result.lastID]);
        res.status(201).json(newSite);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get site details with assigned supervisors
router.get('/:id', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const site = await db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]);

        if (!site) {
            return res.status(404).json({ error: 'Site not found' });
        }

        // Get assigned supervisors
        const supervisors = await db.all(`
            SELECT u.id, u.name, u.phone, ss.assigned_at
            FROM users u
            JOIN site_supervisors ss ON u.id = ss.supervisor_id
            WHERE ss.site_id = ?
        `, [req.params.id]);

        // Get labours at this site
        const labours = await db.all(`
            SELECT * FROM labours WHERE site_id = ? AND status = 'active'
        `, [req.params.id]);

        res.json({ ...site, supervisors, labours });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update site
router.put('/:id', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { name, address, description } = req.body;

    try {
        const db = await openDb();
        await db.run(
            `UPDATE sites SET name = ?, address = ?, description = ? WHERE id = ?`,
            [name, address, description, req.params.id]
        );

        const updated = await db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete site
router.delete('/:id', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        await db.run('DELETE FROM sites WHERE id = ?', [req.params.id]);
        res.json({ message: 'Site deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Assign supervisor to site
router.post('/:id/assign', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { supervisor_id } = req.body;

    if (!supervisor_id) {
        return res.status(400).json({ error: 'Supervisor ID is required' });
    }

    try {
        const db = await openDb();

        // Verify supervisor exists and has supervisor role
        const supervisor = await db.get(
            `SELECT * FROM users WHERE id = ? AND role = 'supervisor'`,
            [supervisor_id]
        );

        if (!supervisor) {
            return res.status(404).json({ error: 'Supervisor not found' });
        }

        await db.run(
            `INSERT INTO site_supervisors (site_id, supervisor_id) VALUES (?, ?)`,
            [req.params.id, supervisor_id]
        );

        res.status(201).json({ message: 'Supervisor assigned to site' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Supervisor already assigned to this site' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Remove supervisor from site
router.delete('/:id/unassign/:supervisorId', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        await db.run(
            'DELETE FROM site_supervisors WHERE site_id = ? AND supervisor_id = ?',
            [req.params.id, req.params.supervisorId]
        );
        res.json({ message: 'Supervisor removed from site' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Assign labour to site
router.post('/:id/assign-labour', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { labour_id } = req.body;
    if (!labour_id) {
        return res.status(400).json({ error: 'Labour ID is required' });
    }
    try {
        const db = await openDb();
        const site = await db.get('SELECT name FROM sites WHERE id = ?', [req.params.id]);
        if (!site) return res.status(404).json({ error: 'Site not found' });
        await db.run('UPDATE labours SET site_id = ?, site = ? WHERE id = ?', [req.params.id, site.name, labour_id]);
        res.json({ message: 'Labour assigned to site' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove labour from site
router.delete('/:id/unassign-labour/:labourId', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        await db.run('UPDATE labours SET site_id = NULL, site = NULL WHERE id = ?', [req.params.labourId]);
        res.json({ message: 'Labour removed from site' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get labours for a specific site
router.get('/:id/labours', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const labours = await db.all(
            "SELECT * FROM labours WHERE site_id = ? AND status = 'active' ORDER BY created_at DESC",
            [req.params.id]
        );
        res.json(labours);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
