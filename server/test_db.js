const {openDb} = require('./database');
async function run() {
    const db = await openDb();
    const date = new Date().toISOString().split('T')[0];
    console.log('Date:', date);
    const query = `
        SELECT 
            s.id as site_id,
            s.name as site_name,
            s.status,
            (SELECT COUNT(*) FROM labours l WHERE l.site_id = s.id AND l.status = 'active') as total_labourers,
            (SELECT COUNT(*) FROM attendance a WHERE a.site_id = s.id AND a.date = ? AND a.status IN ('full', 'half')) as present_count,
            (SELECT COUNT(*) FROM attendance a WHERE a.site_id = s.id AND a.date = ? AND a.status = 'absent') as absent_count,
            MAX(CASE WHEN d.site_id IS NOT NULL THEN 1 ELSE 0 END) as is_submitted
        FROM sites s
        LEFT JOIN daily_site_attendance_status d ON s.id = d.site_id AND d.date = ?
        WHERE s.status = 'active'
           OR d.site_id IS NOT NULL 
           OR (SELECT COUNT(*) FROM attendance a WHERE a.site_id = s.id AND a.date = ?) > 0
        GROUP BY s.id
    `;
    try {
        const res = await db.all(query, [date, date, date, date]);
        console.log('Query result:', res);
        
        const allSites = await db.all(`SELECT id, name, status FROM sites;`);
        console.log('All sites:', allSites);
    } catch (e) {
        console.error(e);
    }
}
run();
