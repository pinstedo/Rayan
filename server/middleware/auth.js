const jwt = require('jsonwebtoken');
const { openDb } = require('../database');
const SECRET_KEY = process.env.JWT_SECRET || 'secret_key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, SECRET_KEY, async (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token.' });
        req.user = user;

        if (user.password_reset_required) {
            const path = req.originalUrl || req.url || '';
            const isAllowed = path.includes('/change-password') || path.includes('/logout');
            if (!isAllowed) {
                return res.status(403).json({
                    error: 'Password reset is required before accessing this resource.',
                    password_reset_required: true
                });
            }
        }

        if (user.tokenId) {
            try {
                const db = await openDb();
                const session = await db.get(
                    `SELECT revoked, replaced_by_token FROM refresh_tokens WHERE id = ?`,
                    [user.tokenId]
                );
                if (session && session.revoked) {
                    if (!session.replaced_by_token) {
                        return res.status(401).json({ error: 'Session revoked. Please log in again.', sessionRevoked: true });
                    }
                    return res.status(401).json({ error: 'Token expired.', tokenExpired: true });
                }
                db.run(`UPDATE refresh_tokens SET last_active_at = NOW() WHERE id = ? AND revoked = false`, [user.tokenId]).catch(() => {});
            } catch (e) {
                // fail-safe continue
            }
        }

        next();
    });
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole };
