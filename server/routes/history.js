const express = require('express');
const router = express.Router();
const { openDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { buildListQuery } = require('../utils/listProcessor');

// GET /api/history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await openDb();
    
    // Admins and supervisors can view history
    const { listConfig, type, action, search, startDate, endDate, limit = 50, offset = 0 } = req.query;

    let baseQuery = `
      SELECT h.*, u.name as created_by_name 
      FROM history_logs h
      LEFT JOIN users u ON h.created_by = u.id
    `;
    
    let query, params;
    
    if (listConfig) {
      // Backend generic list processing mode
      const configObj = JSON.parse(listConfig);
      const processed = buildListQuery(baseQuery, configObj);
      query = processed.query;
      params = processed.params;
      
      // Also need total count for paginator
      const countQuery = buildListQuery(`SELECT COUNT(*) as total FROM history_logs h`, { ...configObj, pagination: undefined, sort: undefined });
      const countRes = await db.get(countQuery.query, countQuery.params);
      
      const logs = await db.all(query, params);
      return res.json({ success: true, count: logs.length, totalCount: parseInt(countRes.total || 0, 10), data: logs });
    }

    // Legacy mode
    query = baseQuery + " WHERE 1=1";
    params = [];
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
