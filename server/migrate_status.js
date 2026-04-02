const { openDb } = require('./database');

async function migrate() {
    try {
        const db = await openDb();
        console.log("Migrating terminated and blacklisted to unassigned...");
        const result = await db.run("UPDATE labours SET status = 'unassigned' WHERE status IN ('terminated', 'blacklisted')");
        console.log(`Updated ${result.changes} records.`);
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        process.exit();
    }
}

migrate();
