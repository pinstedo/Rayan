const { pool } = require('../database');

/**
 * Asynchronously logs a history event to the database.
 * 
 * @param {Object} params
 * @param {string} params.type - 'site', 'labour', 'attendance'
 * @param {string} params.action - 'created', 'updated', 'assigned', 'status_changed', 'marked', 'edited', etc.
 * @param {number} params.reference_id - The ID of the affected entity.
 * @param {string} params.name - name/identifier for quick access/search.
 * @param {Object|string} [params.metadata] - Extra contextual information.
 * @param {number} [params.created_by] - the user id performing the action.
 */
async function logHistory({ type, action, reference_id, name, metadata, created_by }) {
  try {
    const metaStr = metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null;
    
    const query = `
      INSERT INTO history_logs (type, action, reference_id, name, metadata, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    const values = [type, action, reference_id, name, metaStr, created_by || null];
    
    // Fire and forget - don't await on the main thread if possible, 
    // but here we just run it directly on the pool.
    pool.query(query, values).catch(err => {
      console.error('[HistoryLog] Error inserting log:', err);
    });
  } catch (err) {
    console.error('[HistoryLog] Sync error preparing log:', err);
  }
}

module.exports = { logHistory };
