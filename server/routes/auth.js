const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { openDb, pool } = require('../database');

const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { ROLES, ADMIN_ROLES, OWNER_ROLES, ADMIN_OR_OWNER_ROLES } = require('../roles');

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'secret_key';
const TEMP_PASSWORD_EXPIRES_MS = 24 * 60 * 60 * 1000;

const crypto = require('crypto');

const isTemporaryPasswordExpired = (user) => {
    if (!user?.password_reset_required || !user.password_reset_generated_at) return false;
    const generatedTime = new Date(user.password_reset_generated_at).getTime();
    return !Number.isNaN(generatedTime) && Date.now() - generatedTime >= TEMP_PASSWORD_EXPIRES_MS;
};

// Generate tokens (for admin/supervisor users in the `users` table)
const generateTokens = async (user, db, refreshExpiresInDays = 30) => {
    const accessToken = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        SECRET_KEY,
        { expiresIn: '24h' }
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + refreshExpiresInDays * 24 * 60 * 60 * 1000).toISOString();

    await db.run(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
        [user.id, refreshToken, expiresAt]
    );

    return { accessToken, refreshToken };
};

// Signup
router.post('/signup', async (req, res) => {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const db = await openDb();
        const hashedPassword = await bcrypt.hash(password, 10);

        const existingAdmins = await db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`);
        const status = parseInt(existingAdmins.count) > 0 ? 'pending' : 'approved';

        const result = await db.run(
            `INSERT INTO users (name, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?) RETURNING id`,
            [name, phone, hashedPassword, 'admin', status]
        );

        if (status === 'pending') {
            return res.status(201).json({ message: 'Request sent for approval. Please wait for an existing admin to grant you access.', pending: true });
        }

        const user = { id: result.lastID, name, phone, role: 'admin', status };
        const tokens = await generateTokens(user, db);

        res.status(201).json({ message: 'User created successfully', user, ...tokens });
    } catch (err) {
        if (err.code === '23505' || err.message.includes('unique')) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Signin
router.post('/signin', async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Phone and password are required' });
    }

    try {
        const db = await openDb();
        const user = await db.get(`SELECT * FROM users WHERE phone = ?`, [phone]);

        if (user) {
            if (user.is_deleted) {
                return res.status(403).json({ error: 'Account disabled or deleted. Please contact admin.' });
            }

            if (user.status === 'pending') {
                return res.status(403).json({ error: 'Account pending approval. Please wait for an existing admin to grant you access.', pending: true });
            }

            if (user.status === 'rejected') {
                return res.status(403).json({ error: 'Account registration was rejected by an administrator.' });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }

            if (isTemporaryPasswordExpired(user)) {
                return res.status(403).json({
                    error: 'Temporary password expired. Please ask admin to generate a new password.',
                    password_reset_expired: true
                });
            }

            // Single Session Enforcement for Supervisors
            if (user.role === ROLES.SUPERVISOR || user.role === ROLES.SPECIAL_SUPERVISOR) {
                await db.run(
                    `UPDATE refresh_tokens SET revoked = true WHERE user_id = ? AND revoked = false`,
                    [user.id]
                );
            }

            const tokens = await generateTokens(user, db);
            return res.json({
                message: 'Login successful',
                ...tokens,
                user: { id: user.id, name: user.name, phone: user.phone, role: user.role, profile_image: user.profile_image, password_reset_required: !!user.password_reset_required }
            });
        }

        // If not in `users`, check `labours`
        const labour = await db.get(`SELECT * FROM labours WHERE phone = ? AND status = 'active'`, [phone]);

        if (labour) {
            if (!labour.password_hash) {
                return res.status(400).json({ error: 'Account requires password setup. Contact admin.' });
            }

            const isMatch = await bcrypt.compare(password, labour.password_hash);
            if (!isMatch) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }

            if (isTemporaryPasswordExpired(labour)) {
                return res.status(403).json({
                    error: 'Temporary password expired. Please ask admin to generate a new password.',
                    password_reset_expired: true
                });
            }

            const accessToken = jwt.sign(
                { id: labour.id, phone: labour.phone, role: 'labour' },
                SECRET_KEY,
                { expiresIn: '15m' }
            );

            const refreshToken = crypto.randomBytes(40).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            await db.run(
                `INSERT INTO labour_refresh_tokens (labour_id, token, expires_at) VALUES (?, ?, ?)`,
                [labour.id, refreshToken, expiresAt]
            );

            return res.json({
                message: 'Login successful',
                accessToken,
                refreshToken,
                user: { id: labour.id, name: labour.name, phone: labour.phone, role: 'labour', profile_image: labour.profile_image, password_reset_required: !!labour.password_reset_required }
            });
        }

        return res.status(400).json({ error: 'Invalid credentials' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Logout
router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    try {
        const db = await openDb();
        await db.run(`UPDATE refresh_tokens SET revoked = true WHERE token = ?`, [refreshToken]);
        await db.run(`UPDATE labour_refresh_tokens SET revoked = true WHERE token = ?`, [refreshToken]);

        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Refresh Token
router.post('/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    try {
        const db = await openDb();

        // Check User Refresh Tokens
        let storedToken = await db.get(
            `SELECT * FROM refresh_tokens WHERE token = ? AND revoked = false`,
            [refreshToken]
        );

        if (storedToken) {
            if (new Date(storedToken.expires_at) < new Date()) {
                return res.status(403).json({ error: 'Refresh token expired' });
            }

            const user = await db.get(`SELECT * FROM users WHERE id = ?`, [storedToken.user_id]);
            if (!user || user.is_deleted) {
                return res.status(403).json({ error: 'User not found or account disabled' });
            }

            // Revoke old token (Rotation)
            await db.run(`UPDATE refresh_tokens SET revoked = true WHERE id = ?`, [storedToken.id]);

            const newTokens = await generateTokens(user, db);
            return res.json(newTokens);
        }

        // Check Labour Refresh Tokens
        storedToken = await db.get(
            `SELECT * FROM labour_refresh_tokens WHERE token = ? AND revoked = false`,
            [refreshToken]
        );

        if (storedToken) {
            if (new Date(storedToken.expires_at) < new Date()) {
                return res.status(403).json({ error: 'Refresh token expired' });
            }

            const labour = await db.get(`SELECT * FROM labours WHERE id = ?`, [storedToken.labour_id]);
            if (!labour) {
                return res.status(403).json({ error: 'Labour not found' });
            }

            // Revoke old token
            await db.run(`UPDATE labour_refresh_tokens SET revoked = true WHERE id = ?`, [storedToken.id]);

            const accessToken = jwt.sign(
                { id: labour.id, phone: labour.phone, role: 'labour' },
                SECRET_KEY,
                { expiresIn: '15m' }
            );

            const newRefreshToken = crypto.randomBytes(40).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            await db.run(
                `INSERT INTO labour_refresh_tokens (labour_id, token, expires_at) VALUES (?, ?, ?)`,
                [labour.id, newRefreshToken, expiresAt]
            );

            return res.json({ accessToken, refreshToken: newRefreshToken });
        }

        return res.status(403).json({ error: 'Invalid refresh token' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Get all supervisors
router.get('/supervisors', authenticateToken, authorizeRole(ADMIN_OR_OWNER_ROLES), async (req, res) => {
    try {
        const db = await openDb();

        // Automatic cleanup: permanently delete supervisors in bin for > 7 days
        await db.run(`DELETE FROM users WHERE role IN ('supervisor', 'special_supervisor') AND is_deleted = true AND deleted_at < NOW() - INTERVAL '7 days'`);

        const supervisors = await db.all(`SELECT id, name, phone, role FROM users WHERE role IN ('supervisor', 'special_supervisor') AND is_deleted = false`);
        res.json(supervisors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Supervisor or Special Supervisor (Admin Only)
router.post('/add-supervisor', authenticateToken, authorizeRole(ADMIN_ROLES), async (req, res) => {
    const { name, phone, password, role = ROLES.SUPERVISOR } = req.body;

    if (!name || !phone || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const db = await openDb();
        const hashedPassword = await bcrypt.hash(password, 10);

        if (![ROLES.SUPERVISOR, ROLES.SPECIAL_SUPERVISOR].includes(role)) {
            return res.status(400).json({ error: 'Invalid staff role' });
        }

        await db.run(
            `INSERT INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, ?)`,
            [name, phone, hashedPassword, role]
        );

        res.status(201).json({ message: role === ROLES.SPECIAL_SUPERVISOR ? 'Special supervisor added successfully' : 'Supervisor added successfully' });
    } catch (err) {
        if (err.code === '23505' || err.message.includes('unique')) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Update Supervisor (Admin Only)
router.put('/supervisors/:id', authenticateToken, authorizeRole(ADMIN_ROLES), async (req, res) => {
    const { id } = req.params;
    const { name, phone, password } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }

    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role IN ('supervisor', 'special_supervisor')`, [id]);

        if (!existing) {
            return res.status(404).json({ error: 'Supervisor not found' });
        }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.run(
                `UPDATE users SET name = ?, phone = ?, password_hash = ? WHERE id = ?`,
                [name, phone, hashedPassword, id]
            );
        } else {
            await db.run(
                `UPDATE users SET name = ?, phone = ? WHERE id = ?`,
                [name, phone, id]
            );
        }

        res.json({ message: 'Supervisor updated successfully' });
    } catch (err) {
        if (err.code === '23505' || err.message.includes('unique')) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Get advances given by a supervisor (Admin/Owner only)
router.get('/supervisors/:id/advances', authenticateToken, authorizeRole(ADMIN_OR_OWNER_ROLES), async (req, res) => {
    const { id } = req.params;
    try {
        const db = await openDb();
        
        // First verify that the supervisor exists and is a supervisor/special_supervisor
        const supervisor = await db.get(
            `SELECT id, name, phone, role FROM users WHERE id = ? AND role IN ('supervisor', 'special_supervisor') AND is_deleted = false`,
            [id]
        );
        if (!supervisor) {
            return res.status(404).json({ error: 'Supervisor not found' });
        }

        // Fetch advances given by this supervisor
        const advances = await db.all(
            `SELECT a.id, a.amount, a.date, a.notes, a.labour_id, l.name AS labour_name
             FROM advances a
             JOIN labours l ON a.labour_id = l.id
             WHERE a.created_by = ?
             ORDER BY a.date DESC, a.created_at DESC`,
            [id]
        );

        // Group advances by month
        const grouped = {};
        for (const adv of advances) {
            let monthName = 'Unknown Month';
            if (adv.date && adv.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, monthStr] = adv.date.split('-');
                const monthIdx = parseInt(monthStr, 10) - 1;
                const months = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];
                if (monthIdx >= 0 && monthIdx < 12) {
                    monthName = `${months[monthIdx]} ${year}`;
                }
            } else if (adv.date) {
                try {
                    const d = new Date(adv.date);
                    if (!isNaN(d.getTime())) {
                        const months = [
                            "January", "February", "March", "April", "May", "June",
                            "July", "August", "September", "October", "November", "December"
                        ];
                        monthName = `${months[d.getMonth()]} ${d.getFullYear()}`;
                    }
                } catch (e) {}
            }

            if (!grouped[monthName]) {
                grouped[monthName] = {
                    month: monthName,
                    total_amount: 0,
                    advances: []
                };
            }
            grouped[monthName].total_amount += adv.amount;
            grouped[monthName].advances.push(adv);
        }

        // Convert the grouped object to an array
        const result = Object.values(grouped);
        
        res.json(result);
    } catch (err) {
        console.error('Fetch supervisor advances error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get Deleted Supervisors (Bin) — must be registered BEFORE /:id to avoid route conflict
router.get('/supervisors/bin', authenticateToken, authorizeRole(ADMIN_ROLES), async (req, res) => {
    if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ error: 'Only admins can view the bin' });
    }
    try {
        const db = await openDb();
        const supervisors = await db.all(`SELECT id, name, phone, role, deleted_at FROM users WHERE role IN ('supervisor', 'special_supervisor') AND is_deleted = true`);
        res.json(supervisors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a single supervisor details (Admin/Owner only)
router.get('/supervisors/:id', authenticateToken, authorizeRole(ADMIN_OR_OWNER_ROLES), async (req, res) => {
    const { id } = req.params;
    try {
        const db = await openDb();
        const supervisor = await db.get(
            `SELECT id, name, phone, role FROM users WHERE id = ? AND role IN ('supervisor', 'special_supervisor') AND is_deleted = false`,
            [id]
        );
        if (!supervisor) {
            return res.status(404).json({ error: 'Supervisor not found' });
        }
        res.json(supervisor);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Soft Delete a Supervisor (Admin Only)
router.delete('/supervisors/:id', authenticateToken, authorizeRole(ADMIN_ROLES), async (req, res) => {
    const { id } = req.params;
    if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ error: 'Only admins can delete supervisors' });
    }

    const client = await pool.connect();
    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role IN ('supervisor', 'special_supervisor')`, [id]);
        if (!existing) {
            client.release();
            return res.status(404).json({ error: 'Supervisor not found' });
        }

        await client.query('BEGIN');
        await client.query(`UPDATE users SET is_deleted = true, deleted_at = NOW() WHERE id = $1`, [id]);
        await client.query(`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`, [id]);
        await client.query(`DELETE FROM site_supervisors WHERE supervisor_id = $1`, [id]);
        await client.query('COMMIT');

        res.json({ message: 'Supervisor moved to bin successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Direct supervisor password changes are disabled.
// Use /api/admin/users/:id/reset-password so the admin verifies their password,
// the target receives a temporary password, and the target must choose a new one.
router.put('/supervisors/:id/change-password', authenticateToken, authorizeRole(ADMIN_ROLES), async (req, res) => {
    res.status(410).json({ error: 'Direct password changes are disabled. Generate a temporary password from the supervisor details screen.' });
});

// Restore a Supervisor
router.put('/supervisors/:id/restore', authenticateToken, authorizeRole(ADMIN_ROLES), async (req, res) => {
    const { id } = req.params;
    if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ error: 'Only admins can restore supervisors' });
    }

    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role IN ('supervisor', 'special_supervisor') AND is_deleted = true`, [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Deleted supervisor not found' });
        }

        await db.run(`UPDATE users SET is_deleted = false, deleted_at = NULL WHERE id = ?`, [id]);
        res.json({ message: 'Supervisor restored successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Permanently Delete a Supervisor
router.delete('/supervisors/:id/permanent', authenticateToken, authorizeRole(ADMIN_ROLES), async (req, res) => {
    const { id } = req.params;
    if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({ error: 'Only admins can permanently delete supervisors' });
    }

    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role IN ('supervisor', 'special_supervisor') AND is_deleted = true`, [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Deleted supervisor not found' });
        }

        await db.run(`DELETE FROM users WHERE id = ?`, [id]);
        res.json({ message: 'Supervisor permanently deleted' });
    } catch (err) {
        if (err.code === '23503' || err.message.includes('foreign key')) {
            return res.status(400).json({ error: 'Cannot delete supervisor because they have associated records (e.g., attendance or sites).' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Get Pending Admins (Admin Only)
router.get('/admins/pending', authenticateToken, authorizeRole(ADMIN_OR_OWNER_ROLES), async (req, res) => {
    if (![ROLES.ADMIN, ROLES.OWNER].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only approved admins can view pending requests' });
    }

    try {
        const db = await openDb();
        const pendingAdmins = await db.all(`SELECT id, name, phone, created_at FROM users WHERE role = 'admin' AND status = 'pending' AND is_deleted = false`);
        res.json(pendingAdmins);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approve Pending Admin
router.put('/admins/:id/approve', authenticateToken, authorizeRole(ADMIN_OR_OWNER_ROLES), async (req, res) => {
    const { id } = req.params;
    if (![ROLES.ADMIN, ROLES.OWNER].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only approved admins can approve requests' });
    }

    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role = 'admin' AND status = 'pending'`, [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Pending admin request not found' });
        }

        await db.run(`UPDATE users SET status = 'approved' WHERE id = ?`, [id]);
        res.json({ message: 'Admin approved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reject Pending Admin
router.put('/admins/:id/reject', authenticateToken, authorizeRole(ADMIN_OR_OWNER_ROLES), async (req, res) => {
    const { id } = req.params;
    if (![ROLES.ADMIN, ROLES.OWNER].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only approved admins can reject requests' });
    }

    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role = 'admin' AND status = 'pending'`, [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Pending admin request not found' });
        }

        await db.run(`UPDATE users SET status = 'rejected' WHERE id = ?`, [id]);
        res.json({ message: 'Admin registration rejected' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Owner-only Admin Management
router.get('/admins', authenticateToken, authorizeRole(OWNER_ROLES), async (req, res) => {
    try {
        const db = await openDb();
        const admins = await db.all(`
            SELECT id, name, phone, status, is_deleted, deleted_at, created_at
            FROM users
            WHERE role = 'admin'
            ORDER BY created_at DESC
        `);
        res.json(admins);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/admins', authenticateToken, authorizeRole(OWNER_ROLES), async (req, res) => {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
        return res.status(400).json({ error: 'Name, phone, and password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const db = await openDb();
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.run(
            `INSERT INTO users (name, phone, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'approved') RETURNING id`,
            [name, phone, hashedPassword]
        );

        const admin = await db.get(
            `SELECT id, name, phone, status, is_deleted, deleted_at, created_at FROM users WHERE id = ?`,
            [result.lastID]
        );
        res.status(201).json(admin);
    } catch (err) {
        if (err.code === '23505' || err.message.includes('unique')) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.put('/admins/:id', authenticateToken, authorizeRole(OWNER_ROLES), async (req, res) => {
    const { id } = req.params;
    const { name, phone, password } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }

    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role = 'admin'`, [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.run(`UPDATE users SET name = ?, phone = ?, password_hash = ? WHERE id = ?`, [name, phone, hashedPassword, id]);
            await db.run(`UPDATE refresh_tokens SET revoked = true WHERE user_id = ?`, [id]);
        } else {
            await db.run(`UPDATE users SET name = ?, phone = ? WHERE id = ?`, [name, phone, id]);
        }

        const admin = await db.get(
            `SELECT id, name, phone, status, is_deleted, deleted_at, created_at FROM users WHERE id = ?`,
            [id]
        );
        res.json(admin);
    } catch (err) {
        if (err.code === '23505' || err.message.includes('unique')) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.post('/admins/:id/reset-password', authenticateToken, authorizeRole(OWNER_ROLES), async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role = 'admin'`, [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.run(
            `UPDATE users SET password_hash = ?, password_reset_required = true, password_reset_generated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [hashedPassword, id]
        );
        await db.run(`UPDATE refresh_tokens SET revoked = true WHERE user_id = ?`, [id]);
        res.json({ message: 'Admin password reset successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/admins/:id', authenticateToken, authorizeRole(OWNER_ROLES), async (req, res) => {
    const { id } = req.params;
    if (Number(id) === Number(req.user.id)) {
        return res.status(400).json({ error: 'Owners cannot disable themselves through admin management' });
    }

    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role = 'admin'`, [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        await db.run(`UPDATE users SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
        await db.run(`UPDATE refresh_tokens SET revoked = true WHERE user_id = ?`, [id]);
        res.json({ message: 'Admin disabled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/admins/:id/restore', authenticateToken, authorizeRole(OWNER_ROLES), async (req, res) => {
    const { id } = req.params;

    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role = 'admin' AND is_deleted = true`, [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Disabled admin not found' });
        }

        await db.run(`UPDATE users SET is_deleted = false, deleted_at = NULL, status = 'approved' WHERE id = ?`, [id]);
        res.json({ message: 'Admin restored successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/admins/:id/permanent', authenticateToken, authorizeRole(OWNER_ROLES), async (req, res) => {
    const { id } = req.params;

    try {
        const db = await openDb();
        const existing = await db.get(`SELECT * FROM users WHERE id = ? AND role = 'admin' AND is_deleted = true`, [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Disabled admin not found' });
        }

        await db.run(`DELETE FROM users WHERE id = ?`, [id]);
        res.json({ message: 'Admin permanently deleted' });
    } catch (err) {
        if (err.code === '23503' || err.message.includes('foreign key')) {
            return res.status(400).json({ error: 'Cannot delete admin because related records exist. Disable the account instead.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Change Password (Authenticated Users)
const changePasswordHandler = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    try {
        const db = await openDb();

        let table = 'users';
        if (userRole === 'labour') {
            table = 'labours';
        }

        const user = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.password_hash) {
            return res.status(400).json({ error: 'Password not set for this account' });
        }

        if (isTemporaryPasswordExpired(user)) {
            return res.status(403).json({ error: 'Temporary password expired. Please ask admin to generate a new password.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect current password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        const timestamp = new Date().toISOString();
        
        await db.run(
            `UPDATE ${table} 
             SET password_hash = ?, password_reset_required = false, last_password_changed_at = ? 
             WHERE id = ?`,
            [hashedNewPassword, timestamp, userId]
        );

        // Revoke existing sessions (force relogin for safety on password change)
        if (userRole === 'labour') {
            await db.run(`UPDATE labour_refresh_tokens SET revoked = true WHERE labour_id = ?`, [userId]);
        } else {
            await db.run(`UPDATE refresh_tokens SET revoked = true WHERE user_id = ?`, [userId]);
        }

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

router.put('/change-password', authenticateToken, changePasswordHandler);
router.post('/change-password', authenticateToken, changePasswordHandler);

// Update Profile (Authenticated Users)
router.put('/profile', authenticateToken, async (req, res) => {
    const { name, profile_image } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (name === undefined && profile_image === undefined) {
        return res.status(400).json({ error: 'No fields provided to update.' });
    }

    try {
        const db = await openDb();
        let table = 'users';
        if (userRole === 'labour') {
            table = 'labours';
        }

        const user = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newName = name !== undefined ? name : user.name;
        const newProfileImage = profile_image !== undefined ? profile_image : user.profile_image;

        await db.run(
            `UPDATE ${table} SET name = ?, profile_image = ? WHERE id = ?`,
            [newName, newProfileImage, userId]
        );

        const updatedUserRaw = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [userId]);

        const updatedUser = {
            id: updatedUserRaw.id,
            name: updatedUserRaw.name,
            phone: updatedUserRaw.phone,
            role: userRole,
            profile_image: updatedUserRaw.profile_image
        };

        res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
