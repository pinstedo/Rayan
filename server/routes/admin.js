const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { openDb, pool } = require('../database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { logHistory } = require('../utils/historyLogger');

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'secret_key';
const TEMP_PASSWORD_EXPIRES_HOURS = 24;
const TEMP_PASSWORD_EXPIRES_MS = TEMP_PASSWORD_EXPIRES_HOURS * 60 * 60 * 1000;

const getTempPasswordExpiry = (generatedAt) => {
    if (!generatedAt) return null;
    const generatedTime = new Date(generatedAt).getTime();
    if (Number.isNaN(generatedTime)) return null;
    return new Date(generatedTime + TEMP_PASSWORD_EXPIRES_MS).toISOString();
};

const hasActiveTemporaryPassword = (user) => {
    if (!user?.password_reset_required) return false;
    if (!user.password_reset_generated_at) return true;

    const generatedTime = new Date(user.password_reset_generated_at).getTime();
    if (Number.isNaN(generatedTime)) return true;

    return Date.now() - generatedTime < TEMP_PASSWORD_EXPIRES_MS;
};

// Lightweight, memory-based Rate Limiter to prevent brute force
const ipMap = new Map();
const rateLimiter = (limit, windowMs) => {
    return (req, res, next) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const now = Date.now();
        if (!ipMap.has(ip)) {
            ipMap.set(ip, []);
        }
        const requests = ipMap.get(ip);
        const validRequests = requests.filter(time => now - time < windowMs);
        if (validRequests.length >= limit) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }
        validRequests.push(now);
        ipMap.set(ip, validRequests);
        next();
    };
};

// Cryptographically secure random temporary password generator
// Minimum 10 characters, includes uppercase, lowercase, and numbers
function generateTempPassword() {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const allChars = uppercase + lowercase + numbers;

    let password = '';
    
    // Cryptographically secure index selector
    const getSecureRandomInt = (max) => {
        const byte = crypto.randomBytes(1)[0];
        return byte % max;
    };

    // Ensure at least one uppercase, lowercase, and digit
    password += uppercase[getSecureRandomInt(uppercase.length)];
    password += lowercase[getSecureRandomInt(lowercase.length)];
    password += numbers[getSecureRandomInt(numbers.length)];

    // Fill the rest up to 12 characters (which is >= 10 characters)
    for (let i = 3; i < 12; i++) {
        password += allChars[getSecureRandomInt(allChars.length)];
    }

    // Cryptographic shuffle
    return password.split('').sort(() => (crypto.randomBytes(1)[0] % 2) - 0.5).join('');
}

// 1. POST /admin/verify-password
// Requires Admin JWT
// Validates admin password and creates a 60-second verification session token
router.post('/verify-password', authenticateToken, authorizeRole(['admin']), rateLimiter(5, 60 * 1000), async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Admin password is required.' });
    }

    try {
        const db = await openDb();
        const admin = await db.get(`SELECT * FROM users WHERE id = ? AND role = 'admin'`, [req.user.id]);

        if (!admin) {
            return res.status(404).json({ error: 'Admin user not found.' });
        }

        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid admin password.' });
        }

        // Create short-lived JWT token to represent the secure 60s verification session
        const verificationToken = jwt.sign(
            { verification: true, admin_id: admin.id },
            SECRET_KEY,
            { expiresIn: '60s' }
        );

        res.json({
            message: 'Verification successful.',
            verificationToken
        });
    } catch (err) {
        console.error('Verify admin password error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. POST /admin/users/:id/reset-password
// Requires Admin JWT, role-based authorization, and verification token
// Generates and hashes secure temporary password, returning it exactly ONCE. Logs audit trail.
router.post('/users/:id/reset-password', authenticateToken, authorizeRole(['admin']), rateLimiter(10, 60 * 1000), async (req, res) => {
    const { id } = req.params;
    const { role, confirmReplace } = req.body;
    const verificationToken = req.headers['x-verification-token'] || req.body.verificationToken;

    if (!verificationToken) {
        return res.status(401).json({ error: 'Verification session required. Please verify admin password.' });
    }

    if (!['labour', 'supervisor'].includes(role)) {
        return res.status(400).json({ error: 'Role must be labour or supervisor.' });
    }

    try {
        // Verify verification token
        let decoded;
        try {
            decoded = jwt.verify(verificationToken, SECRET_KEY);
            if (!decoded.verification || decoded.admin_id !== req.user.id) {
                throw new Error('Invalid verification session details.');
            }
        } catch (e) {
            return res.status(401).json({ error: 'Verification session expired or invalid. Please verify admin password again.' });
        }

        const db = await openDb();
        let targetUser = null;
        let table = 'users';
        let tokenTable = 'refresh_tokens';
        let tokenUserColumn = 'user_id';

        if (role === 'labour') {
            table = 'labours';
            tokenTable = 'labour_refresh_tokens';
            tokenUserColumn = 'labour_id';
            targetUser = await db.get(`SELECT * FROM labours WHERE id = ?`, [id]);
        } else {
            table = 'users';
            targetUser = await db.get(`SELECT * FROM users WHERE id = ? AND role IN ('supervisor', 'special_supervisor')`, [id]);
        }

        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found.' });
        }

        const activeTemporaryPassword = hasActiveTemporaryPassword(targetUser);
        if (activeTemporaryPassword && !confirmReplace) {
            return res.status(409).json({
                error: 'A temporary password is already active for this user. Confirm to generate a new one.',
                code: 'TEMP_PASSWORD_ACTIVE',
                generatedAt: targetUser.password_reset_generated_at,
                expiresAt: getTempPasswordExpiry(targetUser.password_reset_generated_at),
                expiresInHours: TEMP_PASSWORD_EXPIRES_HOURS
            });
        }

        // Generate temporary password
        const tempPassword = generateTempPassword();
        const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
        const timestamp = new Date().toISOString();

        // Update target user record
        await db.run(
            `UPDATE ${table} 
             SET password_hash = ?, password_reset_required = true, password_reset_generated_at = ? 
             WHERE id = ?`,
            [hashedTempPassword, timestamp, id]
        );

        await db.run(
            `UPDATE ${tokenTable} SET revoked = true WHERE ${tokenUserColumn} = ?`,
            [id]
        );

        // Audit log (never logging actual password)
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await logHistory({
            type: 'admin',
            action: 'PASSWORD_RESET',
            reference_id: parseInt(id),
            name: targetUser.name,
            metadata: {
                admin_id: req.user.id,
                target_user_id: parseInt(id),
                timestamp,
                ip_address: ip,
                target_role: role,
                replaced_active_temporary_password: activeTemporaryPassword,
                action_type: 'PASSWORD_RESET'
            },
            created_by: req.user.id
        });

        // Audit print to standard server logs
        console.log(`[AUDIT] PASSWORD_RESET: Admin ID ${req.user.id} reset password of user ID ${id} (Table: ${table}) from IP ${ip} at ${timestamp}`);

        // Return temporary password ONLY ONCE
        res.json({
            message: 'Password successfully reset.',
            temporaryPassword: tempPassword
        });

    } catch (err) {
        console.error('Password reset error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
