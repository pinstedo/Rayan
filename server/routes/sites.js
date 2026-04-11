const express = require('express');
const { openDb } = require('../database');

const router = express.Router();

const { authorizeRole } = require('../middleware/auth');
const { logHistory } = require('../utils/historyLogger');
const { updateSiteHistory } = require('../utils/siteHistory');

// List all sites (supports ?status=active|inactive filter)
router.get('/', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const { status } = req.query;

        let whereClause = '';
        const params = [];

        if (status === 'active' || status === 'inactive' || status === 'completed') {
            whereClause = 'WHERE s.status = ?';
            params.push(status);
        }

        const sites = await db.all(`
            SELECT 
                s.*,
                COUNT(DISTINCT ss.supervisor_id) as supervisor_count,
                COUNT(DISTINCT l.id) as labour_count
            FROM sites s
            LEFT JOIN site_supervisors ss ON s.id = ss.site_id
            LEFT JOIN labours l ON s.id = l.site_id
            ${whereClause}
            GROUP BY s.id
            ORDER BY s.name ASC
        `, params);
        res.json(sites);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get ACTIVE sites assigned to a supervisor - MUST be before /:id route
router.get('/supervisor/:supervisorId', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const sites = await db.all(`
            SELECT s.*, ss.assigned_at
            FROM sites s
            JOIN site_supervisors ss ON s.id = ss.site_id
            WHERE ss.supervisor_id = ? AND s.status = 'active'
            ORDER BY s.name ASC
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
            `INSERT INTO sites (name, address, description, created_by, status, completion_percentage) VALUES (?, ?, ?, ?, 'active', 0) RETURNING id`,
            [name, address, description, created_by]
        );

        const newSite = await db.get(`SELECT * FROM sites WHERE id = ?`, [result.lastID]);
        
        await logHistory({
            type: 'site',
            action: 'created',
            reference_id: result.lastID,
            name: name,
            metadata: { address, description },
            created_by: created_by || (req.user ? req.user.id : null)
        });

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

// Update site details (name, address, description, completion_percentage)
router.put('/:id', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { name, address, description, completion_percentage } = req.body;

    try {
        const db = await openDb();
        await db.run(
            `UPDATE sites SET name = ?, address = ?, description = ?, completion_percentage = ? WHERE id = ?`,
            [name, address, description, completion_percentage ?? 0, req.params.id]
        );

        const updated = await db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]);
        
        await logHistory({
            type: 'site',
            action: 'updated',
            reference_id: req.params.id,
            name: name,
            metadata: { address, description, completion_percentage },
            created_by: req.user ? req.user.id : null
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle site status (active <-> inactive <-> completed)
router.put('/:id/status', authorizeRole(['admin']), async (req, res) => {
    const { status, notes } = req.body;

    if (!status || !['active', 'inactive', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Status must be "active", "inactive", or "completed"' });
    }

    try {
        const db = await openDb();

        const site = await db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]);
        if (!site) {
            return res.status(404).json({ error: 'Site not found' });
        }

        const today = new Date().toISOString().split('T')[0];
        const lastActiveDate = (status === 'active' || status === 'completed') ? today : site.last_active_date;
        // If status is completed manually via this endpoint, ensure percentage is 100
        const completionPercentage = status === 'completed' ? 100 : site.completion_percentage;

        await db.run(
            `UPDATE sites SET status = ?, notes = COALESCE(?, notes), last_active_date = ?, completion_percentage = ? WHERE id = ?`,
            [status, notes || null, lastActiveDate, completionPercentage, req.params.id]
        );

        const updated = await db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]);
        
        await logHistory({
            type: 'site',
            action: 'status_changed',
            reference_id: req.params.id,
            name: updated.name,
            metadata: { status, notes, completion_percentage: completionPercentage },
            created_by: req.user ? req.user.id : null
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update site completion progress
router.put('/:id/progress', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    let { progress } = req.body;

    if (progress === undefined || isNaN(progress)) {
        return res.status(400).json({ error: 'Valid progress value is required' });
    }

    progress = Math.max(0, Math.min(100, parseFloat(progress)));

    try {
        const db = await openDb();
        const site = await db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]);
        if (!site) return res.status(404).json({ error: 'Site not found' });

        let newStatus = site.status;
        if (progress === 100) {
            newStatus = 'completed';
        } else if (newStatus === 'completed') {
            newStatus = 'active'; // REVERT back to active if progress drops below 100
        }

        await db.run(
            `UPDATE sites SET completion_percentage = ?, status = ? WHERE id = ?`,
            [progress, newStatus, req.params.id]
        );

        const updated = await db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]);
        
        await logHistory({
            type: 'site',
            action: 'progress_updated',
            reference_id: req.params.id,
            name: updated.name,
            metadata: { progress },
            created_by: req.user ? req.user.id : null
        });

        res.json(updated);
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

// Assign labour to site — blocked for inactive sites
router.post('/:id/assign-labour', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { labour_id } = req.body;
    if (!labour_id) {
        return res.status(400).json({ error: 'Labour ID is required' });
    }
    try {
        const db = await openDb();
        const site = await db.get('SELECT name, status FROM sites WHERE id = ?', [req.params.id]);
        if (!site) return res.status(404).json({ error: 'Site not found' });

        // Guard: cannot assign labour to inactive or completed site
        if (site.status === 'inactive' || site.status === 'completed') {
            return res.status(400).json({ error: `Cannot assign labour to a ${site.status} site.` });
        }

        await db.run('UPDATE labours SET site_id = ?, site = ?, status = "active" WHERE id = ?', [req.params.id, site.name, labour_id]);
        await updateSiteHistory(db, labour_id, req.params.id);
        res.json({ message: 'Labour assigned to site' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove labour from site
router.delete('/:id/unassign-labour/:labourId', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        await db.run('UPDATE labours SET site_id = NULL, site = NULL, status = "unassigned" WHERE id = ?', [req.params.labourId]);
        await updateSiteHistory(db, req.params.labourId, null);
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
