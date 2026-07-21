async function updateSiteStatusHistory(db, siteId, newStatus) {
    const today = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];

    // Find any existing active status histories for this site (where to_date is NULL)
    const activeHistories = await db.all(
        `SELECT * FROM site_status_history WHERE site_id = ? AND to_date IS NULL`,
        [siteId]
    );

    for (const h of activeHistories) {
        if (h.status === newStatus) {
            // Already active and has the correct status. Nothing to do.
            return;
        }

        if (h.from_date === today) {
            // If the status was changed today, and is changing to another status today,
            // we delete this record to avoid overlapping and keep history clean
            await db.run('DELETE FROM site_status_history WHERE id = ?', [h.id]);
        } else {
            // Otherwise, close it as of yesterday
            await db.run('UPDATE site_status_history SET to_date = ? WHERE id = ?', [yesterday, h.id]);
        }
    }

    // Open a new record for the new status
    await db.run(
        `INSERT INTO site_status_history (site_id, status, from_date) VALUES (?, ?, ?)`,
        [siteId, newStatus, today]
    );
}

module.exports = { updateSiteStatusHistory };
