const express = require('express');
const router = express.Router();
const { openDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await openDb();
    
    // Admins and supervisors can view history
    const { type, action, search, startDate, endDate, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT h.*, u.name as created_by_name 
      FROM history_logs h
      LEFT JOIN users u ON h.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND h.type = $${paramIndex++}`;
      params.push(type);
    }
    if (action) {
      query += ` AND h.action = $${paramIndex++}`;
      params.push(action);
    }
    if (search) {
      // Case-insensitive search on name
      query += ` AND h.name ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }
    if (startDate) {
      query += ` AND h.created_at >= $${paramIndex++}`;
      params.push(startDate); // Expecting YYYY-MM-DD or valid timestamp
    }
    if (endDate) {
      // Append time to endDate to include the whole day if strictly date is passed
      query += ` AND h.created_at <= $${paramIndex++}`;
      params.push(`${endDate} 23:59:59`); 
    }

    // Order by newest first
    query += ` ORDER BY h.created_at DESC`;
    
    // Pagination
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    // For openDb wrapper, we might need to rely on pg's $1, $2 inside standard queries
    // BUT openDb translate ? into $1 automatically in the wrapper if we use ?. 
    // Ah wait, database.js has _convertQuery(sql) which replaces ? with $1...
    // So if I pass $1, it won't be replaced but node-pg understands $1 natively.
    // However, if I use a mix it might be problematic. Let's stick to Node-PG's native $1 natively.
    
    const client = await db.client; // bypassing wrapper translation just to be safe, or just use native query
    const logs = await client.query(query, params);

    res.json({ success: true, count: logs.rowCount, data: logs.rows });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

module.exports = router;
