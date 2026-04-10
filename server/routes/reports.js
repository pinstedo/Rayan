const express = require('express');
const { openDb } = require('../database');

const router = express.Router();

const { authorizeRole } = require('../middleware/auth');

// POST /api/reports/site-attendance
router.post('/site-attendance', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const date = req.body.date || new Date().toISOString().split('T')[0];

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
        const reports = await db.all(query, [date, date, date, date]);
        res.json(reports);
    } catch (err) {
        console.error('Error serving site attendance report:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/reports/labour-summary
router.post('/labour-summary', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const { startDate, endDate, site_id } = req.body;

        console.log('Fetching labour summary report for:', { startDate, endDate, site_id });

        // Fetch global food allowance rate
        const rateRow = await db.get(`SELECT value FROM app_settings WHERE key = 'food_allowance_rate'`);
        const globalFoodRate = rateRow ? parseFloat(rateRow.value) : 70;

        let labourQuery = `SELECT * FROM labours`;
        const labourParams = [];

        if (site_id) {
            labourQuery += ` WHERE site_id = ?`;
            labourParams.push(site_id);
        }

        const labours = await db.all(labourQuery, labourParams);

        // Fetch food_provided status for all dates in range
        let foodStatusQuery = `SELECT site_id, date, food_provided FROM daily_site_attendance_status`;
        const foodStatusParams = [];
        const conditions = [];
        if (startDate) {
            conditions.push(`date >= ?`);
            foodStatusParams.push(startDate);
        }
        if (endDate) {
            conditions.push(`date <= ?`);
            foodStatusParams.push(endDate);
        }
        if (site_id) {
            conditions.push(`site_id = ?`);
            foodStatusParams.push(site_id);
        }
        if (conditions.length > 0) {
            foodStatusQuery += ` WHERE ` + conditions.join(' AND ');
        }

        const foodStatusRows = await db.all(foodStatusQuery, foodStatusParams);
        const foodProvidedMap = new Map(); // "site_id:date" -> true/false
        foodStatusRows.forEach(row => {
            if (row.food_provided == 1 || row.food_provided === 'true') {
                foodProvidedMap.set(`${row.site_id}:${row.date}`, true);
            }
        });

        const reports = [];

        for (const labour of labours) {
            // Attendance Stats
            let attendanceQuery = `
                SELECT status, COUNT(*) as count 
                FROM attendance 
                WHERE labour_id = ? 
            `;
            const attendanceParams = [labour.id];

            if (startDate) {
                attendanceQuery += ` AND date >= ?`;
                attendanceParams.push(startDate);
            }
            if (endDate) {
                attendanceQuery += ` AND date <= ?`;
                attendanceParams.push(endDate);
            }
            if (site_id) {
                attendanceQuery += ` AND site_id = ?`;
                attendanceParams.push(site_id);
            }

            attendanceQuery += ` GROUP BY status`;

            const attendanceStats = await db.all(attendanceQuery, attendanceParams);

            let fullDays = 0;
            let halfDays = 0;
            let absentDays = 0;

            attendanceStats.forEach(stat => {
                if (stat.status === 'full') fullDays = stat.count;
                else if (stat.status === 'half') halfDays = stat.count;
                else if (stat.status === 'absent') absentDays = stat.count;
            });

            // Overtime
            let overtimeQuery = `
                SELECT SUM(amount) as total_amount 
                FROM overtime 
                WHERE labour_id = ?
            `;
            const overtimeParams = [labour.id];

            if (startDate) {
                overtimeQuery += ` AND date >= ?`;
                overtimeParams.push(startDate);
            }
            if (endDate) {
                overtimeQuery += ` AND date <= ?`;
                overtimeParams.push(endDate);
            }
            if (site_id) {
                overtimeQuery += ` AND site_id = ?`;
                overtimeParams.push(site_id);
            }

            const overtimeResult = await db.get(overtimeQuery, overtimeParams);
            const overtimeAmount = overtimeResult.total_amount || 0;

            // Advances
            let advanceQuery = `
                 SELECT SUM(amount) as total_amount 
                 FROM advances 
                 WHERE labour_id = ?
            `;
            const advanceParams = [labour.id];

            if (startDate) {
                advanceQuery += ` AND date >= ?`;
                advanceParams.push(startDate);
            }
            if (endDate) {
                advanceQuery += ` AND date <= ?`;
                advanceParams.push(endDate);
            }

            const advanceResult = await db.get(advanceQuery, advanceParams);
            const advanceAmount = advanceResult.total_amount || 0;

            // Food Allowance Calculation (site-level + per-labour)
            let detailedAttendanceQuery = `
                SELECT date, site_id, status, food_allowance, allowance as food_allowance_amount
                FROM attendance
                WHERE labour_id = ? AND status IN ('full', 'half')
            `;
            const detailedParams = [labour.id];
            if (startDate) {
                detailedAttendanceQuery += ` AND date >= ?`;
                detailedParams.push(startDate);
            }
            if (endDate) {
                detailedAttendanceQuery += ` AND date <= ?`;
                detailedParams.push(endDate);
            }
            if (site_id) {
                detailedAttendanceQuery += ` AND site_id = ?`;
                detailedParams.push(site_id);
            }

            const detailedAttendance = await db.all(detailedAttendanceQuery, detailedParams);

            let perLabourFoodAmount = 0;  // Explicit per-labour food allowance
            let siteLevelFoodCount = 0;   // Days food NOT provided by supervisor at site

            detailedAttendance.forEach(record => {
                if (record.food_allowance) {
                    // Per-labour food allowance explicitly set
                    perLabourFoodAmount += Number(record.food_allowance_amount) || 0;
                } else {
                    // Fall back to site-level: if food not provided, add global rate
                    const key = `${record.site_id}:${record.date}`;
                    if (!foodProvidedMap.has(key)) {
                        siteLevelFoodCount++;
                    }
                }
            });

            const siteLevelFoodAmount = siteLevelFoodCount * globalFoodRate;
            const foodAllowanceAmount = perLabourFoodAmount + siteLevelFoodAmount;

            // Calculation
            const hourlyRate = labour.rate || 0;
            const wage = (fullDays * 8 * hourlyRate) + (halfDays * 4 * hourlyRate);
            const netPayable = wage + overtimeAmount - advanceAmount + foodAllowanceAmount;

            reports.push({
                id: labour.id,
                name: labour.name,
                rate: hourlyRate,
                full_days: fullDays,
                half_days: halfDays,
                absent_days: absentDays,
                wage: wage,
                overtime_amount: overtimeAmount,
                advance_amount: advanceAmount,
                food_allowance_amount: foodAllowanceAmount,
                per_labour_food_amount: perLabourFoodAmount,
                site_level_food_amount: siteLevelFoodAmount,
                net_payable: netPayable
            });
        }

        res.json(reports);

    } catch (err) {
        console.error('Error generating labour summary report:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/reports/payments/salary - Record a salary payment
router.post('/payments/salary', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const { labour_id, amount, date, month_reference, payment_method, notes } = req.body;

        if (!labour_id || !amount || !date || !month_reference) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const db = await openDb();
        const result = await db.run(
            `INSERT INTO salary_payments (labour_id, amount, date, month_reference, payment_method, notes, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
            [labour_id, amount, date, month_reference, payment_method || 'Cash', notes || '', req.user.id]
        );

        res.status(201).json({ id: result.lastID, message: 'Salary payment recorded successfully' });
    } catch (error) {
        console.error('Error recording salary payment:', error);
        res.status(500).json({ error: 'Internal server error while saving payment' });
    }
});

// POST /api/reports/wage-month
router.post('/wage-month', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const { month, site_id } = req.body; // format: YYYY-MM

        if (!month) {
            return res.status(400).json({ error: 'Month is required (YYYY-MM)' });
        }

        const [year, monthNum] = month.split('-');
        const startDate = `${month}-01`;
        // Calculate last day of month
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${month}-${lastDay}`;
        const prevEndDate = `${month}-01`; // exclusive

        console.log('Generating wage report for:', { month, startDate, endDate, site_id });

        // 1. Get Labours (filter by site if needed)
        let labourQuery = `SELECT * FROM labours`;
        const labourParams = [];
        if (site_id) {
            labourQuery += ` WHERE site_id = ?`;
            labourParams.push(site_id);
        }
        const labours = await db.all(labourQuery, labourParams);

        // 2. Pre-fetch Food Provided Status
        const allowMap = new Map();
        const allStatus = await db.all(`SELECT site_id, date, food_provided FROM daily_site_attendance_status`);
        allStatus.forEach(row => {
            if (row.food_provided == 1 || row.food_provided === 'true') {
                allowMap.set(`${row.site_id}:${row.date}`, true);
            }
        });

        // 3. Fetch global food allowance rate
        const rateRow = await db.get(`SELECT value FROM app_settings WHERE key = 'food_allowance_rate'`);
        const globalFoodRate = rateRow ? parseFloat(rateRow.value) : 70;

        // Helper to calculate financials for a date range
        // If rangeEnd is null, it means "Before rangeStart" (Previous Balance)
        // If rangeEnd is set, it means "Between rangeStart and rangeEnd" (Current Month)
        const calculateStats = async (labour, rangeStart, rangeEnd, isPrevious) => {
            let fullDays = 0;
            let halfDays = 0;
            let foodAllowanceCount = 0;
            let wage = 0;

            // -- Attendance --
            let attQuery = `SELECT date, site_id, status, food_allowance, allowance FROM attendance WHERE labour_id = ?`;
            const attParams = [labour.id];

            if (isPrevious) {
                attQuery += ` AND date < ?`;
                attParams.push(rangeStart);
            } else {
                attQuery += ` AND date >= ? AND date <= ?`;
                attParams.push(rangeStart);
                attParams.push(rangeEnd);
            }

            const attendanceRecs = await db.all(attQuery, attParams);

            attendanceRecs.forEach(rec => {
                if (rec.status === 'full') fullDays++;
                if (rec.status === 'half') halfDays++;

                // Food Allowance Logic
                // Per-labour explicit allowance takes priority; otherwise site-level fallback
                if (rec.status === 'full' || rec.status === 'half') {
                    if (rec.food_allowance) {
                        // Per-labour food allowance explicitly set
                        foodAllowanceCount += Number(rec.allowance) || 0;
                    } else if (!allowMap.has(`${rec.site_id}:${rec.date}`)) {
                        // Site-level: food not provided, add global rate
                        foodAllowanceCount += globalFoodRate;
                    }
                }
            });

            const rate = labour.rate || 0;
            wage = (fullDays * 8 * rate) + (halfDays * 4 * rate);
            const foodAmount = foodAllowanceCount;

            // -- Overtime --
            let otQuery = `SELECT SUM(amount) as total FROM overtime WHERE labour_id = ?`;
            const otParams = [labour.id];
            if (isPrevious) {
                otQuery += ` AND date < ?`;
                otParams.push(rangeStart);
            } else {
                otQuery += ` AND date >= ? AND date <= ?`;
                otParams.push(rangeStart);
                otParams.push(rangeEnd);
            }
            const otRes = await db.get(otQuery, otParams);
            const otAmount = otRes && otRes.total ? otRes.total : 0;

            // -- Advances --
            let advQuery = `SELECT SUM(amount) as total FROM advances WHERE labour_id = ?`;
            const advParams = [labour.id];
            if (isPrevious) {
                advQuery += ` AND date < ?`;
                advParams.push(rangeStart);
            } else {
                advQuery += ` AND date >= ? AND date <= ?`;
                advParams.push(rangeStart);
                advParams.push(rangeEnd);
            }
            const advRes = await db.get(advQuery, advParams);
            const advAmount = advRes && advRes.total ? advRes.total : 0;

            // -- Salary Payments (for calculating previous balance net correctly)
            let paidQuery = `SELECT SUM(amount) as total FROM salary_payments WHERE labour_id = ?`;
            const paidParams = [labour.id];
            if (isPrevious) {
                // If previous, we subtract ANY salary payment made before this month
                paidQuery += ` AND date < ?`;
                paidParams.push(rangeStart);
            } else {
                // If current, we don't naturally subtract payments from the "net payable" 
                // because net payable defines the AMOUNT OWED for the work done this month.
                // We'll track what was PAID this month separately.
                paidQuery += ` AND date >= ? AND date <= ?`;
                paidParams.push(rangeStart);
                paidParams.push(rangeEnd);
            }
            const paidRes = await db.get(paidQuery, paidParams);
            const paidAmount = paidRes && paidRes.total ? paidRes.total : 0;

            return {
                wage,
                otAmount,
                foodAmount,
                advAmount,
                paidAmount,
                fullDays,
                halfDays,
                foodAllowanceCount,
                net: isPrevious ? (wage + otAmount + foodAmount - advAmount - paidAmount) : (wage + otAmount + foodAmount - advAmount)
            };
        };

        const reports = [];

        for (const labour of labours) {
            // 1. Previous Balance (Before startDate)
            const prevStats = await calculateStats(labour, startDate, null, true);
            const previous_balance = prevStats.net;

            // 2. Current Month Stats (startDate to endDate)
            const currStats = await calculateStats(labour, startDate, endDate, false);

            reports.push({
                id: labour.id,
                name: labour.name,
                rate: labour.rate,
                site_id: labour.site_id,

                // Previous Balance
                previous_balance: previous_balance,

                // Current Month Details
                current_wage: currStats.wage,
                current_overtime_amount: currStats.otAmount,
                current_food_allowance_amount: currStats.foodAmount,
                current_advance_amount: currStats.advAmount,

                current_full_days: currStats.fullDays,
                current_half_days: currStats.halfDays,
                current_food_allowance_days: currStats.foodAllowanceCount,

                // Net for this month (Earnings - Advances)
                current_net_payable: currStats.net,

                // What was physically paid in this date range
                salary_paid: currStats.paidAmount,

                // Total Payable
                total_payable: previous_balance + currStats.net,

                // Closing Balance (Total Payable - Paid)
                closing_balance: (previous_balance + currStats.net) - currStats.paidAmount
            });
        }

        // Optional: filter out those entirely inactive (net 0, no previous balance, no current days)
        // Usually handled dynamically on frontend.

        res.json(reports);

    } catch (err) {
        console.error('Error generating wage month report:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/reports/complaints - Allow labours to submit a complaint
router.post('/complaints', async (req, res) => {
    try {
        const { complaint } = req.body;
        // In the LabourDashboard, we make an authenticated request, but we also can get the token here
        // The token is checked in authenticateToken middleware if we add it, but since reports.js
        // handles multiple roles we might need to parse auth header manually or use an existing middleware

        // Let's use authenticateToken if available, or just parse the Bearer for labour ID
        const authHeader = req.headers['authorization'];
        let tokenLabourId = null;
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            // Decode the token (assumes jwt is available, but let's just do a manual decode or trust a passed ID if we don't have the secret here easily)
            // A safer way: import jwt
            const jwt = require('jsonwebtoken');
            const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';
            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                tokenLabourId = decoded.id; // Either user id or labour id
                // If the token has a role = admin/supervisor, they shouldn't be submitting labour complaints, 
                // but we can allow it for testing if needed.
            } catch (err) {
                // Ignore verify error here, let it fail on insert if needed
            }
        }

        if (!complaint || typeof complaint !== 'string' || complaint.trim() === '') {
            return res.status(400).json({ error: 'Complaint text is required' });
        }

        const db = await openDb();
        const result = await db.run(
            `INSERT INTO complaints (labour_id, complaint, status) VALUES (?, ?, 'unread') RETURNING id`,
            [tokenLabourId, complaint.trim()]
        );

        res.status(201).json({ id: result.lastID, message: 'Complaint submitted successfully' });
    } catch (error) {
        console.error('Error submitting complaint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/reports/unread-count - Admin fetches the count of unread complaints and pending approvals
router.get('/unread-count', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const row = await db.get(`SELECT COUNT(*) as count FROM complaints WHERE status = 'unread'`);
        const pendingRow = await db.get(`SELECT COUNT(*) as count FROM labours WHERE status = 'pending'`);
        res.json({
            unreadComplaintsCount: row.count || 0,
            pendingLaboursCount: pendingRow.count || 0,
            unreadCount: (row.count || 0) + (pendingRow.count || 0)
        });
    } catch (error) {
        console.error('Error fetching unread complaint and pending count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/reports/complaints - Admin fetches the list of complaints
router.get('/complaints', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        // Fetch complaints joined with labour info and site info
        const complaints = await db.all(`
            SELECT 
                c.id, c.complaint, c.status, c.created_at, 
                l.name as labour_name, l.profile_image,
                s.name as site_name 
            FROM complaints c 
            LEFT JOIN labours l ON c.labour_id = l.id 
            LEFT JOIN sites s ON l.site_id = s.id
            ORDER BY c.created_at DESC
        `);
        res.json(complaints);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/reports/complaints/mark-read - Admin marks all unread complaints as read
router.put('/complaints/mark-read', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const { id } = req.body; // Optional ID to mark specific complaint

        if (id) {
            await db.run(`UPDATE complaints SET status = 'read' WHERE id = ?`, [id]);
            res.json({ message: 'Complaint marked as read' });
        } else {
            await db.run(`UPDATE complaints SET status = 'read' WHERE status = 'unread'`);
            res.json({ message: 'All complaints marked as read' });
        }
    } catch (error) {
        console.error('Error marking complaints as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/reports/complaints/:id - Admin deletes a specific complaint
router.delete('/complaints/:id', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'Complaint ID is required' });
        }

        const result = await db.run(`DELETE FROM complaints WHERE id = ?`, [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Complaint not found' });
        }
        res.json({ message: 'Complaint deleted successfully' });
    } catch (error) {
        console.error('Error deleting complaint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/reports/bonus-attendance-range
router.post('/bonus-attendance-range', authorizeRole(['admin', 'supervisor']), async (req, res) => {
    try {
        const db = await openDb();
        const { startDate, endDate, site_id } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        console.log('Generating bonus and attendance report for:', { startDate, endDate, site_id });

        let labourQuery = `SELECT * FROM labours`;
        const labourParams = [];
        if (site_id) {
            labourQuery += ` WHERE site_id = ?`;
            labourParams.push(site_id);
        }
        const labours = await db.all(labourQuery, labourParams);

        const reports = [];

        for (const labour of labours) {
            let fullDaysTotal = 0;
            let halfDaysTotal = 0;
            let absentDaysTotal = 0;
            let bonusAmountTotal = 0;
            let incrementMonthsCount = 0;
            let bonusMonthsCount = 0;

            const monthlyData = {};

            // Helper to initialize month if not exists
            const ensureMonth = (month) => {
                if (!monthlyData[month]) {
                    monthlyData[month] = { attendance: 0, bonus_amount: 0, has_increment: false };
                }
            };

            // 1. Attendance
            const attRecs = await db.all(
                `SELECT status, LEFT(date, 7) as month FROM attendance WHERE labour_id = ? AND date >= ? AND date <= ?`,
                [labour.id, startDate, endDate]
            );

            attRecs.forEach(rec => {
                if (!rec.month) return;
                ensureMonth(rec.month);
                if (rec.status === 'full') {
                    monthlyData[rec.month].attendance += 1;
                    fullDaysTotal++;
                } else if (rec.status === 'half') {
                    monthlyData[rec.month].attendance += 0.5;
                    halfDaysTotal++;
                } else if (rec.status === 'absent') {
                    absentDaysTotal++;
                }
            });

            // 2. Bonus
            const bonusRecs = await db.all(
                `SELECT amount, LEFT(date, 7) as month FROM bonus_payments WHERE labour_id = ? AND date >= ? AND date <= ?`,
                [labour.id, startDate, endDate]
            );

            bonusRecs.forEach(rec => {
                if (!rec.month) return;
                ensureMonth(rec.month);
                monthlyData[rec.month].bonus_amount += rec.amount;
                bonusAmountTotal += rec.amount;
            });

            // Rough tracking of how many unique months got a bonus
            bonusMonthsCount = new Set(bonusRecs.filter(r => r.amount > 0).map(r => r.month)).size;

            // 3. Salary History
            const salaryHistoryRecs = await db.all(
                `SELECT LEFT(date, 7) as month FROM salary_history WHERE labour_id = ? AND date >= ? AND date <= ?`,
                [labour.id, startDate, endDate]
            );

            salaryHistoryRecs.forEach(rec => {
                if (!rec.month) return;
                ensureMonth(rec.month);
                monthlyData[rec.month].has_increment = true;
            });

            incrementMonthsCount = new Set(salaryHistoryRecs.map(r => r.month)).size;

            reports.push({
                id: labour.id,
                name: labour.name,
                rate: labour.rate,
                site_id: labour.site_id,
                total_working_days: fullDaysTotal + (halfDaysTotal * 0.5),
                full_days: fullDaysTotal,
                half_days: halfDaysTotal,
                absent_days: absentDaysTotal,
                total_bonus: bonusAmountTotal,
                total_bonus_months: bonusMonthsCount,
                total_increment_months: incrementMonthsCount,
                monthly_data: monthlyData
            });
        }

        res.json(reports);

    } catch (err) {
        console.error('Error generating bonus/attendance report:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
