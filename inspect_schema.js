const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

(async () => {
    const db = await open({
        filename: './server/proto.db', // Adjusted path relative to root
        driver: sqlite3.Database
    });

    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table';");
    console.log("Tables:", tables.map(t => t.name));

    for (const table of tables) {
        if (table.name === 'sqlite_sequence') continue;
        const schema = await db.all(`PRAGMA table_info(${table.name});`);
        console.log(`\nSchema for ${table.name}:`, schema);
    }
})();
