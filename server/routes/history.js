const express = require('express');
const router = express.Router();
const { openDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { buildListQuery } = require('../utils/listProcessor');

function normalizeHistoryLog(log) {
  if (!log) return log;
  let name = log.name;
  const siteName = log.site_name;
  if (name && siteName) {
    name = name.replace(/^Attendance for Site #?\d+/i, `Attendance for ${siteName}`);
  }
  return {
    ...log,
    name: name || siteName || (log.reference_id ? `ID #${log.reference_id}` : 'System Event')
  };
}

// GET /api/history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await openDb();
    
    // Admins and supervisors can view history
    const { listConfig, type, action, search, startDate, endDate, limit = 50, offset = 0 } = req.query;

    let baseQuery = `
      SELECT h.*, u.name as created_by_name,
        CASE
          WHEN h.type = 'site' THEN h.name
          WHEN h.type = 'attendance' THEN (
            COALESCE(
              (SELECT s.name FROM sites s WHERE s.id = h.reference_id),
              (CASE WHEN h.metadata IS NOT NULL AND (h.metadata::text LIKE '%"site"%' OR h.metadata::text LIKE '%"site_name"%' OR h.metadata::text LIKE '%"site_id"%') THEN 
                COALESCE(
                  (SELECT s.name FROM sites s WHERE s.name = (h.metadata::json->>'site')),
                  (SELECT s.name FROM sites s WHERE s.name = (h.metadata::json->>'site_name')),
                  (SELECT s.name FROM sites s WHERE s.id::text = (h.metadata::json->>'site_id')),
                  (SELECT s.name FROM sites s WHERE s.id::text = (h.metadata::json->>'site')),
                  (h.metadata::json->>'site_name'),
                  (h.metadata::json->>'site')
                )
               ELSE NULL END),
              (SELECT s.name FROM attendance a JOIN sites s ON a.site_id = s.id WHERE a.labour_id = h.reference_id ORDER BY a.id DESC LIMIT 1)
            )
          )
          WHEN h.type = 'labour' THEN (
            COALESCE(
              (SELECT s.name FROM labours l JOIN sites s ON l.site_id = s.id WHERE l.id = h.reference_id),
              (SELECT s.name FROM labour_site_history lsh JOIN sites s ON lsh.site_id = s.id WHERE lsh.labour_id = h.reference_id ORDER BY lsh.id DESC LIMIT 1),
              (CASE WHEN h.metadata IS NOT NULL AND (h.metadata::text LIKE '%"site"%' OR h.metadata::text LIKE '%"site_name"%' OR h.metadata::text LIKE '%"site_id"%') THEN 
                COALESCE(
                  (SELECT s.name FROM sites s WHERE s.name = (h.metadata::json->>'site')),
                  (SELECT s.name FROM sites s WHERE s.name = (h.metadata::json->>'site_name')),
                  (SELECT s.name FROM sites s WHERE s.id::text = (h.metadata::json->>'site_id')),
                  (SELECT s.name FROM sites s WHERE s.id::text = (h.metadata::json->>'site')),
                  (h.metadata::json->>'site_name'),
                  (h.metadata::json->>'site')
                )
               ELSE NULL END)
            )
          )
          ELSE (
            CASE WHEN h.metadata IS NOT NULL AND (h.metadata::text LIKE '%"site_id"%' OR h.metadata::text LIKE '%"site_name"%' OR h.metadata::text LIKE '%"site"%') THEN
              COALESCE(
                (SELECT s.name FROM sites s WHERE s.id::text = (h.metadata::json->>'site_id')),
                (SELECT s.name FROM sites s WHERE s.name = (h.metadata::json->>'site')),
                (SELECT s.name FROM sites s WHERE s.name = (h.metadata::json->>'site_name')),
                (h.metadata::json->>'site_name'),
                (h.metadata::json->>'site')
              )
            ELSE NULL END
          )
        END as site_name
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
      return res.json({ success: true, count: logs.length, totalCount: parseInt(countRes.total || 0, 10), data: logs.map(normalizeHistoryLog) });
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

    const client = await db.client;
    const logs = await client.query(query, params);

    res.json({ success: true, count: logs.rowCount, data: logs.rows.map(normalizeHistoryLog) });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

module.exports = router;
