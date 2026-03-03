require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./database');
const authRoutes = require('./routes/auth');
const labourRoutes = require('./routes/labours');
const dashboardRoutes = require('./routes/dashboard');
const sitesRoutes = require('./routes/sites');
const attendanceRoutes = require('./routes/attendance');
const searchRoutes = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

const { authenticateToken } = require('./middleware/auth');

// Routes
app.use('/api/sites', authenticateToken, sitesRoutes);
app.use('/api/auth', authRoutes); // Auth routes (signin/signup) remain public

app.use('/api/labours', authenticateToken, labourRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/attendance', authenticateToken, attendanceRoutes);
app.use('/api/overtime', authenticateToken, require('./routes/overtime'));
app.use('/api/reports', authenticateToken, require('./routes/reports'));
app.use('/api/search', authenticateToken, searchRoutes);

app.get('/', (req, res) => {
    res.send('Welcome to the Labour Management Server');
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Start server
const startServer = async () => {
    try {
        await initDb();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to initialize database:', err);
    }
};

startServer();