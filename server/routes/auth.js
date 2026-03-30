const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { openDb } = require('../database');

const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'secret_key';

const crypto = require('crypto');

// Generate tokens
const generateTokens = async (user, db, refreshExpiresInDays = 30) => {
    const accessToken = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        SECRET_KEY,
        { expiresIn: '24h' } // Short-lived access token
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + refreshExpiresInDays * 24 * 60 * 60 * 1000).toISOString();

    await db.run(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
        [user.id, refreshToken, expiresAt] // user.id here might need to be careful if it conflicts with admin/supervisor user ids? 
        // Wait, labours are in 'labours' table, users (admin/super) are in 'users' table.
        // IDs might collide. 
        // We need to differentiate user type in refresh_tokens or use a global ID system.
        // OR we can add a 'user_type' column to refresh_tokens.
        // For now, let's assume we need to handle this.
        // Let's check the schema again. 'users' table has 'users'. 'labours' table has 'labours'.
        // Both have 'id' starting from 1.
        // IMPORTANT: We need to distinguish them.
        // Let's add 'user_type' to refresh_tokens? Or just store a composite like 'labour_123'?
        // The implementation plan didn't specify this but it's CRITICAL.
        // Let's check existing generateTokens usage. It's used for admins/supervisors in 'users' table.
        // If I use it for labours, I must differentiate.
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

        // Check if there are any existing admins to decide if this one should be pending or approved
        const existingAdmins = await db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`);
        const status = existingAdmins.count > 0 ? 'pending' : 'approved';

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
        if (err.message.includes('UNIQUE constraint failed')) {
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

            // Single Session Enforcement for Supervisors
            if (user.role === 'supervisor') {
                // Revoke any existing active sessions to allow login on the new device 
                // while enforcing single-device usage.
                await db.run(
                    `UPDATE refresh_tokens SET revoked = true WHERE user_id = ? AND revoked = false`,
                    [user.id]
                );
            }

            const tokens = await generateTokens(user, db);
            console.log('Signin generated tokens:', tokens);
            return res.json({
                message: 'Login successful',
                ...tokens,
                user: { id: user.id, name: user.name, phone: user.phone, role: user.role, profile_image: user.profile_image }
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
                user: { id: labour.id, name: labour.name, phone: labour.phone, role: 'labour', profile_image: labour.profile_image }
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
        // Also try to revoke from labour_refresh_tokens just in case, or make it specific?
        // The implementation plan focused on supervisors (users table -> refresh_tokens). 
        // But let's be safe and check both or just the one relevant.
        // Given we don't know the type of user from just the token easily without a query, 
        // and we want to be robust:
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

            // For supervisors, do we allow refresh if a new session was created elsewhere? 
            // The single session check is at Login. 
            // If we are refreshing, it means we ARE the active session (unless we were hijacked).
            // But if we enforce STRICT single session, we should perhaps fail if there are *other* active tokens?
            // But we just revoked the current one 2 lines ago.
            // So we are safe to generate a new one.

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

            // Generate new tokens for labour (7 days)
            // We need a separate generate function or adapt the existing one.
            // Let's inline or adapt.
            // NOTE: generateTokens helper forces 'refresh_tokens' table. We should refactor or duplicate logic.
            // Duplicating for clarity/safety now.

            const accessToken = jwt.sign(
                { id: labour.id, phone: labour.phone, role: 'labour' },
                SECRET_KEY,
                { expiresIn: '15m' }
            );

            const newRefreshToken = crypto.randomBytes(40).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

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
router.get('/supervisors', authenticateToken, async (req, res) => {
    try {
        const db = await openDb();

        // Automatic cleanup: permanently delete supervisors in bin for > 7 days
        await db.run(`DELETE FROM users WHERE role = 'supervisor' AND is_deleted = true AND deleted_at < NOW() - INTERVAL '7 days'`);

        const supervisors = await db.all(`SELECT id, name, phone FROM users WHERE role = 'supervisor' AND is_deleted = false`);
        res.json(supervisors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Supervisor (Admin Only)
router.post('/add-supervisor', authenticateToken, async (req, res) => {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const db = await openDb();
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.run(
            `INSERT INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, ?)`,
            [name, phone, hashedPassword, 'supervisor']
        );

        res.status(201).json({ message: 'Supervisor added successfully' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Update Supervisor (Admin Only)
router.put('/supervisors/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, phone, password } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }

    try {
        const db = await openDb();
        const existing = await db.get('SELECT * FROM users WHERE id = ? AND role = "supervisor"', [id]);

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
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Soft Delete a Supervisor (Admin Only)
router.delete('/supervisors/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can delete supervisors' });
    }

    try {
        const db = await openDb();
        const existing = await db.get('SELECT * FROM users WHERE id = ? AND role = "supervisor"', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Supervisor not found' });
        }

        await db.run('BEGIN TRANSACTION');
        try {
            // Soft delete user
            await db.run(`UPDATE users SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
            // Revoke sessions
            await db.run(`UPDATE refresh_tokens SET revoked = true WHERE user_id = ?`, [id]);
            // Remove site assignments
            await db.run(`DELETE FROM site_supervisors WHERE supervisor_id = ?`, [id]);

            await db.run('COMMIT');
            res.json({ message: 'Supervisor moved to bin successfully' });
        } catch (txnErr) {
            await db.run('ROLLBACK');
            throw txnErr;
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin changes Supervisor Password
router.put('/supervisors/:id/change-password', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can change supervisor passwords' });
    }

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    try {
        const db = await openDb();
        const existing = await db.get('SELECT * FROM users WHERE id = ? AND role = "supervisor"', [id]);

        if (!existing) {
            return res.status(404).json({ error: 'Supervisor not found' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.run(
            `UPDATE users SET password_hash = ? WHERE id = ?`,
            [hashedPassword, id]
        );

        res.json({ message: 'Supervisor password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Deleted Supervisors (Bin)
router.get('/supervisors/bin', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can view the bin' });
    }
    try {
        const db = await openDb();
        const supervisors = await db.all(`SELECT id, name, phone, deleted_at FROM users WHERE role = 'supervisor' AND is_deleted = true`);
        res.json(supervisors);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Restore a Supervisor
router.put('/supervisors/:id/restore', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can restore supervisors' });
    }

    try {
        const db = await openDb();
        const existing = await db.get('SELECT * FROM users WHERE id = ? AND role = "supervisor" AND is_deleted = true', [id]);
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
router.delete('/supervisors/:id/permanent', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can permanently delete supervisors' });
    }

    try {
        const db = await openDb();
        const existing = await db.get('SELECT * FROM users WHERE id = ? AND role = "supervisor" AND is_deleted = true', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Deleted supervisor not found' });
        }

        await db.run(`DELETE FROM users WHERE id = ?`, [id]);
        res.json({ message: 'Supervisor permanently deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Pending Admins (Admin Only)
router.get('/admins/pending', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
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
router.put('/admins/:id/approve', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only approved admins can approve requests' });
    }

    try {
        const db = await openDb();
        const existing = await db.get('SELECT * FROM users WHERE id = ? AND role = "admin" AND status = "pending"', [id]);
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
router.put('/admins/:id/reject', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only approved admins can reject requests' });
    }

    try {
        const db = await openDb();
        const existing = await db.get('SELECT * FROM users WHERE id = ? AND role = "admin" AND status = "pending"', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Pending admin request not found' });
        }

        // We can either set status to rejected or just delete the row entirely
        await db.run(`UPDATE users SET status = 'rejected' WHERE id = ?`, [id]);
        res.json({ message: 'Admin registration rejected' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Change Password (Authenticated Users)
router.put('/change-password', authenticateToken, async (req, res) => {
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

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect current password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.run(
            `UPDATE ${table} SET password_hash = ? WHERE id = ?`,
            [hashedNewPassword, userId]
        );

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile (Authenticated Users)
router.put('/profile', authenticateToken, async (req, res) => {
    const { name, profile_image } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Optional: we can require at least one field to update
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
        // Allows clearing the image by sending null or empty string
        const newProfileImage = profile_image !== undefined ? profile_image : user.profile_image;

        await db.run(
            `UPDATE ${table} SET name = ?, profile_image = ? WHERE id = ?`,
            [newName, newProfileImage, userId]
        );

        // Fetch updated user to return
        const updatedUserRaw = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [userId]);

        // Structure the response object safely
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

// Clear Database (Admin Only)
router.delete('/clear-database', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can clear the database' });
    }

    try {
        const db = await openDb();

        await db.run('BEGIN TRANSACTION');

        try {
            await db.run('DELETE FROM attendance');
            await db.run('DELETE FROM daily_site_attendance_status');
            await db.run('DELETE FROM advances');
            await db.run('DELETE FROM overtime');
            await db.run('DELETE FROM site_supervisors');
            await db.run('DELETE FROM sites');
            await db.run('DELETE FROM labour_refresh_tokens');
            await db.run('DELETE FROM labours');

            await db.run(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE role != 'admin')`);
            await db.run(`DELETE FROM users WHERE role != 'admin'`);

            await db.run('COMMIT');
            res.json({ message: 'Database cleared successfully' });
        } catch (txnErr) {
            await db.run('ROLLBACK');
            throw txnErr;
        }
    } catch (err) {
        console.error("Clear database error:", err);
        res.status(500).json({ error: 'Failed to clear database' });
    }
});

module.exports = router;
