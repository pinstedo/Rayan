const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        await pool.query("UPDATE users SET status = 'approved' WHERE phone = '2222222222'");
        
        const http = require('http');
        const req = http.request('http://localhost:5000/api/auth/signin', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' } 
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                console.log('SIGNIN STATUS:', res.statusCode);
                console.log('SIGNIN RESPONSE:', data);
                pool.end();
            });
        });

        req.write(JSON.stringify({ phone: '2222222222', password: 'password123' }));
        req.end();
        req.on('error', (e) => {
            console.error('Request error:', e);
            pool.end();
        });
    } catch (e) {
        console.error('Query error:', e);
        pool.end();
    }
}
run();
