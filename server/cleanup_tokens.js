const { openDb } = require('./database');

async function cleanTokens() {
    try {
        const db = await openDb();

        console.log("Analyzing refresh token tables...");
        const expiredUsers = await db.get(`SELECT COUNT(*) as count FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true`);
        const expiredLabours = await db.get(`SELECT COUNT(*) as count FROM labour_refresh_tokens WHERE expires_at < NOW() OR revoked = true`);

        console.log(`Found ${expiredUsers.count} expired or revoked user refresh tokens.`);
        console.log(`Found ${expiredLabours.count} expired or revoked labour refresh tokens.`);

        if (parseInt(expiredUsers.count) > 0 || parseInt(expiredLabours.count) > 0) {
            console.log("Deleting unnecessary tokens...");
            const delUsers = await db.run(`DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true`);
            const delLabours = await db.run(`DELETE FROM labour_refresh_tokens WHERE expires_at < NOW() OR revoked = true`);

            console.log(`Successfully deleted ${delUsers.changes || 0} user refresh tokens.`);
            console.log(`Successfully deleted ${delLabours.changes || 0} labour refresh tokens.`);
        } else {
            console.log("No expired or revoked tokens found to delete.");
        }

    } catch (err) {
        console.error('Error cleaning tokens:', err);
    } finally {
        process.exit(0);
    }
}

cleanTokens();
