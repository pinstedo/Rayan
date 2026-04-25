async function updateSiteHistory(db, labourId, newSiteId = null) {
    const today = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];

    let queryParams = [labourId];
    let siteFilter = '';
    
    if (newSiteId !== null && newSiteId !== undefined) {
        siteFilter = ` AND site_id != ?`;
        queryParams.push(newSiteId);
    }

    // Find any existing active assignment for this labour that is NOT the new site
    const activeHistories = await db.all(
        `SELECT * FROM labour_site_history WHERE labour_id = ? AND to_date IS NULL${siteFilter}`,
        queryParams
    );

    for (const h of activeHistories) {
        if (h.from_date === today) {
            // If they were assigned today and unassigned today, just delete the history record
            await db.run('DELETE FROM labour_site_history WHERE id = ?', [h.id]);
        } else {
            // Otherwise close it as of yesterday
            await db.run('UPDATE labour_site_history SET to_date = ? WHERE id = ?', [yesterday, h.id]);
        }
    }

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
