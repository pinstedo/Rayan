const express = require('express');
const bcrypt = require('bcryptjs');
const { openDb, openTransactionDb } = require('../database');

const router = express.Router();

// Middleware to verify token would go here in a real app
// For this proto, we might skip strict token verification on every route or add it later

const { authorizeRole } = require('../middleware/auth');
const { logHistory } = require('../utils/historyLogger');
const { updateSiteHistory } = require('../utils/siteHistory');

// List all labours or filter by supervisor
router.get('/', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const { supervisor_id, status } = req.query;

        let query = 'SELECT * FROM labours';
        const params = [];
        const conditions = [];

        // Status filtering
        if (status === 'active' || status === 'assigned') {
            conditions.push("site_id IS NOT NULL AND status != 'leave' AND status != 'pending'");
        } else if (status === 'unassigned') {
            conditions.push("site_id IS NULL AND status != 'leave' AND status != 'pending'");
        } else if (status === 'leave') {
            conditions.push("status = 'leave'");
        } else if (status === 'pending') {
            conditions.push("status = 'pending'");
        } else {
            // Default behavior: return all if not specified
        }

        if (supervisor_id) {
            query = `
                SELECT l.* 
                FROM labours l
                JOIN site_supervisors ss ON l.site_id = ss.site_id
            `;
            conditions.push('ss.supervisor_id = ?');
            params.push(supervisor_id);
            conditions.push("l.status = 'active'");
        }

        if (conditions.length > 0) {
            if (supervisor_id) {
                query = `
                    SELECT l.* 
                    FROM labours l
                    JOIN site_supervisors ss ON l.site_id = ss.site_id
                    WHERE ss.supervisor_id = ? AND l.status = 'active'
                `;
                params.length = 0;
                params.push(supervisor_id);
            } else {
                query += ' WHERE ' + conditions.join(' AND ');
            }
        }

        query += ' ORDER BY created_at DESC';

        const labours = await db.all(query, params);
        res.json(labours);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new labour
router.post('/', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { name, phone, password, aadhaar, site, site_id, rate, notes, date_of_birth } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    if (!phone || phone.length !== 10) {
        return res.status(400).json({ error: 'Valid 10-digit phone number is required' });
    }

    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (rate && isNaN(parseFloat(rate))) {
        return res.status(400).json({ error: 'Rate must be a valid number' });
    }

    try {
        const db = await openDb();

        // Fetch all labours to check for duplicates (more robust check)
        const allLabours = await db.all('SELECT id, phone, aadhaar FROM labours');

        // Loosely check for duplicate phone (string/number safety)
        const existingPhone = allLabours.find(l => l.phone == phone);
        if (existingPhone) {
            return res.status(400).json({ error: 'A labour with this phone number already exists' });
        }

        // Check for duplicate aadhaar
        if (aadhaar) {
            if (aadhaar.length !== 12) {
                return res.status(400).json({ error: 'Aadhaar number must be 12 digits' });
            }
            const existingAadhaar = allLabours.find(l => l.aadhaar == aadhaar);
            if (existingAadhaar) {
                return res.status(400).json({ error: 'A labour with this Aadhaar number already exists' });
            }
        }

        const password_hash = await bcrypt.hash(password, 10);

        // If supervisor is creating, status is pending. If admin creates without a site, it's unassigned.
        const initialStatus = req.user && req.user.role === 'supervisor' ? 'pending' : (site_id ? 'active' : 'unassigned');

        const result = await db.run(
            `INSERT INTO labours (name, phone, password_hash, aadhaar, site, site_id, rate, notes, date_of_birth, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
            [name, phone, password_hash, aadhaar, site, site_id, rate, notes, date_of_birth, initialStatus]
        );

        const newLabour = await db.get(`SELECT * FROM labours WHERE id = ?`, [result.lastID]);
        
        if (site_id) {
            await updateSiteHistory(db, result.lastID, site_id);
        }

        await logHistory({
            type: 'labour',
            action: 'created',
            reference_id: result.lastID,
            name: name,
            metadata: { phone, site, status: initialStatus },
            created_by: req.user ? req.user.id : null
        });

        res.status(201).json(newLabour);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get labours assigned to a site on a specific date based on history
router.get('/by-site-date', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const { siteId, date } = req.query;
        if (!siteId || !date) {
            return res.status(400).json({ error: 'siteId and date query parameters are required' });
        }

        const db = await openDb();
        const labours = await db.all(`
            SELECT DISTINCT l.* 
            FROM labours l
            LEFT JOIN labour_site_history h ON l.id = h.labour_id 
                AND h.site_id = ? AND h.from_date <= ? AND (h.to_date IS NULL OR h.to_date >= ?)
            LEFT JOIN attendance a ON l.id = a.labour_id 
                AND a.site_id = ? AND a.date = ?
            WHERE h.id IS NOT NULL OR a.id IS NOT NULL
            ORDER BY l.name ASC
        `, [siteId, date, date, siteId, date]);

        res.json(labours);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Backdate assign labours
router.post('/backdate-assign', authorizeRole(['admin']), async (req, res) => {
    const { from_date, site_id, labour_ids } = req.body;
    
    if (!from_date || !site_id || !Array.isArray(labour_ids) || labour_ids.length === 0) {
        return res.status(400).json({ error: 'from_date, site_id, and an array of labour_ids are required' });
    }

    try {
        const db = await openTransactionDb();
        
        try {
            await db.run('BEGIN');
            
            // Find existing histories starting exactly on this date for this site
            const existingHistories = await db.all('SELECT * FROM labour_site_history WHERE site_id = ? AND from_date = ?', [site_id, from_date]);
            const laboursToRemove = existingHistories.filter(h => !labour_ids.includes(h.labour_id));
            
            // Delete the history records for the labours being removed
            for (const h of laboursToRemove) {
                await db.run('DELETE FROM labour_site_history WHERE id = ?', [h.id]);
                // Note: As requested, we DO NOT modify the labour's table (status or site_id)
                // so they retain their current assignment for the current day.
            }
            
            for (const id of labour_ids) {
                const alreadyExists = existingHistories.find(h => h.labour_id === id);
                
                if (alreadyExists) {
                    await db.run('UPDATE labours SET site_id = ?, status = ? WHERE id = ?', [site_id, 'active', id]);
                    if (alreadyExists.to_date !== null) {
                        await db.run('UPDATE labour_site_history SET to_date = NULL WHERE id = ?', [alreadyExists.id]);
                    }
                    continue;
                }
                // Update labours table
                await db.run('UPDATE labours SET site_id = ?, status = ? WHERE id = ?', [site_id, 'active', id]);
                
                // Close open history if any
                const openHist = await db.get('SELECT * FROM labour_site_history WHERE labour_id = ? AND to_date IS NULL', [id]);
                if (openHist) {
                    await db.run('UPDATE labour_site_history SET to_date = ? WHERE id = ?', [from_date, openHist.id]);
                }
                
                // Insert new history
                await db.run('INSERT INTO labour_site_history (labour_id, site_id, from_date) VALUES (?, ?, ?)', [id, site_id, from_date]);
            }
            
            // Log history
            await db.run('INSERT INTO history_logs (type, action, metadata, created_by) VALUES (?, ?, ?, ?)', 
                ['labour', 'bulk_backdated_assignment', JSON.stringify({ count: labour_ids.length, site_id, from_date }), req.user ? req.user.id : null]);
            
            await db.run('COMMIT');
            res.json({ message: 'Labours successfully backdate assigned' });
        } catch (err) {
            await db.run('ROLLBACK');
            throw err;
        } finally {
            if (db.release) db.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get own details (for logged in labour)
router.get('/me', async (req, res) => {
    // Assuming middleware puts user info in req.user
    // But this file is /api/labours, so usage: /api/labours/me
    // Authentication middleware must be present.
    try {
        const db = await openDb();
        if (!req.user || req.user.role !== 'labour') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const labour = await db.get('SELECT * FROM labours WHERE id = ?', [req.user.id]);
        if (!labour) {
            return res.status(404).json({ error: 'Labour not found' });
        }
        res.json(labour);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update own profile (Labour)
router.put('/me', async (req, res) => {
    try {
        const db = await openDb();
        if (!req.user || req.user.role !== 'labour') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { profile_image, date_of_birth, emergency_phone } = req.body;

        // Only allow updating specific fields
        await db.run(
            `UPDATE labours SET profile_image = ?, date_of_birth = ?, emergency_phone = ? WHERE id = ?`,
            [profile_image, date_of_birth, emergency_phone, req.user.id]
        );

        const updated = await db.get('SELECT * FROM labours WHERE id = ?', [req.user.id]);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get labours eligible for bonus (worked_days_count >= 275)
// NOTE: Must be defined BEFORE /:id route to avoid param matching
router.get('/eligible', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const labours = await db.all(
            `SELECT id, name, phone, site, site_id, rate, status,
                    worked_days_count, increment_cycle_count, total_bonus_earned
             FROM labours
             WHERE worked_days_count >= 275
             ORDER BY worked_days_count DESC`
        );
        // Add calculated bonus to each labour
        const result = labours.map(l => ({
            ...l,
            rate: (l.rate || 0) * 8,  // convert hourly -> daily for display
            bonus_due: Math.round((Number(l.worked_days_count) / 22) * 100) / 100,
            progress_percent: Math.min(100, Math.round((Number(l.worked_days_count) / 275) * 100))
        }));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get labour details
router.get('/:id', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const labour = await db.get('SELECT * FROM labours WHERE id = ?', [req.params.id]);

        if (!labour) {
            return res.status(404).json({ error: 'Labour not found' });
        }

        res.json(labour);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Debug endpoint
router.get('/debug-me', (req, res) => {
    res.json({ user: req.user, headers: req.headers });
});

// Update labour
router.put('/:id', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { name, phone, aadhaar, site, site_id, rate, notes, profile_image, date_of_birth, emergency_phone } = req.body;

    try {
        const db = await openDb();
        const currentLabour = await db.get('SELECT * FROM labours WHERE id = ?', [req.params.id]);
        if (!currentLabour) {
            return res.status(404).json({ error: 'Labour not found' });
        }

        // Handle rate change history
        if (rate !== undefined && parseFloat(rate) !== currentLabour.rate) {
            const today = new Date().toISOString().split('T')[0];
            await db.run(
                `INSERT INTO salary_history (labour_id, previous_rate, new_rate, date, created_by) VALUES (?, ?, ?, ?, ?)`,
                [req.params.id, currentLabour.rate || 0, parseFloat(rate), today, req.user ? req.user.id : null]
            );
        }

        let newStatus = currentLabour.status;
        if (site_id) {
            newStatus = 'active';
        } else if (!site_id) {
            if (currentLabour.status !== 'leave') {
                newStatus = 'unassigned';
            }
        }

        await db.run(
            `UPDATE labours SET name = ?, phone = ?, aadhaar = ?, site = ?, site_id = ?, rate = ?, notes = ?, profile_image = ?, date_of_birth = ?, emergency_phone = ?, status = ? WHERE id = ?`,
            [name, phone, aadhaar, site, site_id, rate, notes, profile_image, date_of_birth, emergency_phone, newStatus, req.params.id]
        );

        if (site_id != currentLabour.site_id) {
            await updateSiteHistory(db, req.params.id, site_id || null);
        }

        const updated = await db.get('SELECT * FROM labours WHERE id = ?', [req.params.id]);
        
        await logHistory({
            type: 'labour',
            action: 'updated',
            reference_id: req.params.id,
            name: name,
            metadata: { phone, site, rate },
            created_by: req.user ? req.user.id : null
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete labour
router.delete('/:id', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        await db.run('DELETE FROM labours WHERE id = ?', [req.params.id]);
        res.json({ message: 'Labour deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update labour status
router.put('/:id/status', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    let { status } = req.body;
    const allowedStatuses = ['active', 'unassigned', 'pending', 'leave'];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const db = await openDb();
        
        // If worker is set ACTIVE without site -> treat as INACTIVE (unassigned)
        if (status === 'active') {
            const labour = await db.get('SELECT site_id FROM labours WHERE id = ?', [req.params.id]);
            if (!labour.site_id) {
                status = 'unassigned';
            }
        }

        if (status === 'unassigned' || status === 'leave') {
            await db.run(
                'UPDATE labours SET status = ?, site_id = NULL, site = NULL WHERE id = ?',
                [status, req.params.id]
            );
            await updateSiteHistory(db, req.params.id, null);
        } else {
            await db.run(
                'UPDATE labours SET status = ? WHERE id = ?',
                [status, req.params.id]
            );
        }

        // CRITICAL: Reset worked_days_count immediately when marked on leave
        if (status === 'leave') {
            await db.run(
                'UPDATE labours SET worked_days_count = 0 WHERE id = ?',
                [req.params.id]
            );
        }

        const updated = await db.get('SELECT * FROM labours WHERE id = ?', [req.params.id]);
        
        await logHistory({
            type: 'labour',
            action: 'status_changed',
            reference_id: req.params.id,
            name: updated.name,
            metadata: { status },
            created_by: req.user ? req.user.id : null
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Bonus (manual legacy endpoint kept for backward compat)
router.post('/:id/bonus', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { amount, date, notes } = req.body;
    const labour_id = req.params.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
    }
    const bonusDate = date || new Date().toISOString().split('T')[0];

    try {
        const db = await openDb();
        const result = await db.run(
            `INSERT INTO bonus_payments (labour_id, amount, date, notes, created_by) VALUES (?, ?, ?, ?, ?) RETURNING id`,
            [labour_id, amount, bonusDate, notes, req.user ? req.user.id : null]
        );

        const newBonus = await db.get('SELECT * FROM bonus_payments WHERE id = ?', [result.lastID]);
        res.status(201).json(newBonus);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Apply manual increment to labour salary
router.post('/:id/increment', authorizeRole(['admin']), async (req, res) => {
    const { increment_amount } = req.body;
    const labour_id = req.params.id;

    if (!increment_amount || isNaN(Number(increment_amount)) || Number(increment_amount) <= 0) {
        return res.status(400).json({ error: 'increment_amount must be a positive number' });
    }

    const incrementAmt = Number(increment_amount);
    const db = await openTransactionDb();

    try {
        await db.run('BEGIN');

        // Fetch current labour (rate is stored as hourly = daily / 8)
        const labour = await db.get('SELECT * FROM labours WHERE id = ?', [labour_id]);
        if (!labour) {
            await db.run('ROLLBACK');
            return res.status(404).json({ error: 'Labour not found' });
        }

        const currentDailyRate = (labour.rate || 0) * 8; // convert hourly → daily
        const newDailyRate = currentDailyRate + incrementAmt;
        const newHourlyRate = newDailyRate / 8;
        const workedDaysAtTime = Number(labour.worked_days_count) || 0;
        const today = new Date().toISOString().split('T')[0];

        // Update salary (stored as hourly), reset worked_days_count, increment cycle count
        await db.run(
            `UPDATE labours 
             SET rate = ?, worked_days_count = 0, increment_cycle_count = increment_cycle_count + 1
             WHERE id = ?`,
            [newHourlyRate, labour_id]
        );

        // Record in legacy salary_history table (backward compatibility)
        await db.run(
            `INSERT INTO salary_history (labour_id, previous_rate, new_rate, date, created_by) VALUES (?, ?, ?, ?, ?)`,
            [labour_id, labour.rate || 0, newHourlyRate, today, req.user ? req.user.id : null]
        );

        // Record in new financial history table
        await db.run(
            `INSERT INTO labour_financial_history (labour_id, type, amount, worked_days_at_time) VALUES (?, 'increment', ?, ?)`,
            [labour_id, incrementAmt, workedDaysAtTime]
        );

        await db.run('COMMIT');

        await logHistory({
            type: 'labour',
            action: 'increment_applied',
            reference_id: labour_id,
            name: labour.name,
            metadata: { increment_amount: incrementAmt, new_daily_rate: newDailyRate, worked_days_reset: workedDaysAtTime },
            created_by: req.user ? req.user.id : null
        });

        const updated = await db.get('SELECT * FROM labours WHERE id = ?', [labour_id]);
        res.json(updated);
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        if (db.release) db.release();
    }
});

// Get financial history (bonus + increment) for a labour
router.get('/:id/financial-history', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const records = await db.all(
            `SELECT * FROM labour_financial_history WHERE labour_id = ? ORDER BY created_at DESC`,
            [req.params.id]
        );
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Advance
router.post('/:id/advance', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    const { amount, date, notes, created_by } = req.body;
    const labour_id = req.params.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
    }
    if (!date) {
        return res.status(400).json({ error: 'Date is required' });
    }

    try {
        const db = await openDb();
        const result = await db.run(
            `INSERT INTO advances (labour_id, amount, date, notes, created_by) VALUES (?, ?, ?, ?, ?) RETURNING id`,
            [labour_id, amount, date, notes, created_by]
        );

        const newAdvance = await db.get('SELECT * FROM advances WHERE id = ?', [result.lastID]);
        res.status(201).json(newAdvance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Advances for a Labour
router.get('/:id/advances', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    // Note: Labours should only see their own advances.
    // The query filters by labour_id (params.id).
    // If a labour fetches /:id/advances, we must ensure :id matches req.user.id if they are a labour.
    // But for now, authorizeRole(['labour']) allows them to hit the endpoint.
    // Let's add that check inside the handler in a later step if needed, or refine here.
    // Actually, let's keep it simple: admin/supervisor can see any. labour can see?
    // The previous implementation didn't restrict.
    // Let's assume labours need to see their own advances.
    // I will add 'labour' to allowed roles here, BUT strict data ownership check is separate.
    // Given the task is strict security, I should probably allow labours only for THEIR OWN id.
    // But middleware just checks role.
    // So for now, I'll allow 'labour' role, but ideally we need ownership check.
    // However, the dashboard fetches /my-attendance. Does it fetch advances?
    // The dashboard doesn't seem to fetch advances yet.
    // So maybe restricting to admin/supervisor is safer if labours don't use it.
    // Let's stick to admin/supervisor for now as per "strict" request.

    try {
        const db = await openDb();
        const advances = await db.all(
            'SELECT * FROM advances WHERE labour_id = ? ORDER BY date DESC, created_at DESC',
            [req.params.id]
        );
        res.json(advances);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
