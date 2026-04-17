async function updateSiteHistory(db, labourId, newSiteId = null) {
    const today = new Date().toISOString().split('T')[0];

    let query = `UPDATE labour_site_history 
         SET to_date = ? 
         WHERE labour_id = ? 
           AND to_date IS NULL`;
    let params = [today, labourId];

    if (newSiteId !== null && newSiteId !== undefined) {
        query += ` AND site_id != ?`;
        params.push(newSiteId);
    }

    // Close any existing active assignment for this labour that is NOT the new site
    await db.run(query, params);

    // If assigning to a new site, open a new record (if not already open)
    if (newSiteId) {
        const existing = await db.get(
            `SELECT id FROM labour_site_history 
             WHERE labour_id = ? AND site_id = ? AND to_date IS NULL`,
            [labourId, newSiteId]
        );

        if (!existing) {
            await db.run(
                `INSERT INTO labour_site_history (labour_id, site_id, from_date) 
                 VALUES (?, ?, ?)`,
                [labourId, newSiteId, today]
            );
        }
    }
}

module.exports = { updateSiteHistory };
