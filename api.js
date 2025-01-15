require('dotenv').config();
const express = require('express');
// const https = require('https');
const http = require('http');
const morgan = require('morgan');
const sqlFunctions = require('./sql');
const { body, query, validationResult } = require('express-validator');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(morgan('dev'));

// Endpoint to serve the endpoints.html file
app.get('/public/endpoints.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'endpoints.html'));
});

const db = new sqlFunctions();

const PORT = process.env.PORT || 3000;

// Validation middleware
const validateUser = [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one capital letter and one number'),
    body('first_name').notEmpty().withMessage('First name is required').isAlpha().withMessage('First name cannot contain numbers'),
    body('last_name').notEmpty().withMessage('Last name is required').isAlpha().withMessage('Last name cannot contain numbers')
];

const validateUserDetails = [
    query('username').optional().isString().withMessage('Username must be a string'),
    query('first_name').optional().isString().withMessage('First name must be a string'),
    query('last_name').optional().isString().withMessage('Last name must be a string')
];

const validateStatistic = [
    body('user_id').isInt().withMessage('User ID must be an integer'),
    body('kills').isNumeric().withMessage('Kills must be numeric'),
    body('date').notEmpty().withMessage('Date is required')
];

const validateDateRange = [
    query('start_date').notEmpty().withMessage('Start date is required').isISO8601().withMessage('Start date must be a valid date'),
    query('end_date').optional().isISO8601().withMessage('End date must be a valid date')
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.query.start_date)) {
                throw new Error('End date must be after start date');
            }
            return true;
        })
];

const validateDate = [
    query('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Date must be a valid date')
];

const validateKills = [
    query('kills').isInt({ min: 0 }).withMessage('Kills must be a positive integer')
];

const validatePhoneNumber = [
    body('phone').matches(/^\+32 \d{3} \d{2} \d{2} \d{2}$/).withMessage('Phone number must be in the format +32 444 44 44 44')
];

// Middleware to check if the request is from localhost
const checkLocalhost = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    if (ip === '127.0.0.1' || ip === '::1') {
        console.log('Request from localhost:', ip);
        next();
    } else {
        res.status(403).send('Forbidden: This endpoint can only be accessed from localhost');
    }
};

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Routes for users
app.post('/createUser', validateUser, handleValidationErrors, async (req, res) => {
    try {
        const createdUser = await db.createUser(req.body);
        // console.log('created user: ', createdUser);
        res.status(201).send(createdUser);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.put('/users/:id', validateUser, handleValidationErrors, async (req, res) => {
    try {
        await db.updateUser(req.params.id, req.body);
        res.send('User updated');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/users/:id', async (req, res) => {
    try {
        await db.deleteUser(req.params.id);
        res.send('User deleted');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Example endpoint with sorting
app.get('/users', [
    query('sort_by').optional().isIn(['username', 'first_name', 'last_name']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order')
], async (req, res) => {
    const { sort_by, order } = req.query;
    const users = await db.getAllUsers(sort_by, order);
    res.json(users);
});

// Search users by username
app.get('/users/search', async (req, res) => {
    const { username } = req.query;
    try {
        const users = await db.searchUserByUsername(username);
        res.json(users);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Route for searching users by username, first_name, and last_name
app.get('/users/searchByDetails', validateUserDetails, handleValidationErrors, async (req, res) => {
    const { username = '', first_name = '', last_name = '' } = req.query;

    try {
        const users = await db.searchUserByDetails(username, first_name, last_name);
        res.json(users);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Route to delete users with less than a certain amount of kills
app.delete('/deleteUsersBelowKills', async (req, res) => {
    const { kills } = req.query;
    // console.log('kills: ', kills);
    try {
        await db.deleteUsersWithLessThanKills(parseInt(kills));
        res.send('Users deleted');
    } catch (err) {
        console.error('Error deleting users:', err.message);
        res.status(500).send(err.message);
    }
});

// Routes for statistics
app.post('/addStatistics', validateStatistic, handleValidationErrors, async (req, res) => {
    try {
        await db.createStatistic(req.body);
        res.status(201).send('Statistic created');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.put('/statistics/:id', validateStatistic, handleValidationErrors, async (req, res) => {
    try {
        await db.updateStatistic(req.params.id, req.body);
        res.send('Statistic updated');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/statistics/:id', async (req, res) => {
    try {
        await db.deleteStatistic(req.params.id);
        res.send('Statistic deleted');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/statistics', async (req, res) => {
    try {
        const statistics = await db.getAllStatistics();
        res.json(statistics);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Statistics pagination
app.get('/statistics/paginate', async (req, res) => {
    const { limit, offset } = req.query;
    try {
        const statistics = await db.getStatisticsWithLimitOffset(parseInt(limit), parseInt(offset));
        res.json(statistics);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Searching statistics by date range
app.get('/statistics/search', validateDateRange, handleValidationErrors, async (req, res) => {
    const { start_date, end_date } = req.query;
    const endDate = end_date || new Date().toISOString().split('T')[0]; // Default to current date if end_date is not provided

    if (new Date(start_date) > new Date(endDate)) {
        return res.status(400).send('End date must be more recent than start date');
    }

    try {
        const statistics = await db.searchStatisticsByDateRange(start_date, endDate);
        res.json(statistics);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Searching statistics by a specific date
app.get('/statistics/searchByDate', validateDate, handleValidationErrors, async (req, res) => {
    const { date } = req.query;

    try {
        const statistics = await db.searchStatisticsByDate(date);
        res.json(statistics);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/testRunning', (req, res) => {
    res.send('Server is running');
});

// Endpoint to test all other endpoints
app.get('/testEndpoints', async (req, res) => {
    const currentTime = Math.floor(Date.now() / 1000);
    const endpoints = [
        { method: 'post', url: '/createUser', data: { username: `testuser${currentTime}`, password: 'Test1234', first_name: 'Test', last_name: 'User' } },
        { method: 'get', url: '/users' },
        { method: 'get', url: '/users/search', params: { username: `testuser${currentTime}` } },
        { method: 'get', url: '/users/searchByDetails', params: { username: `testuser${currentTime}`, first_name: 'Test', last_name: 'User' } },
        { method: 'get', url: '/statistics' },
        { method: 'post', url: '/addStatistics', data: { user_id: null, kills: 10, date: '2023-01-01' } },
        { method: 'put', url: '/statistics/1', data: { user_id: null, kills: 20, date: '2023-01-02' } },
        { method: 'delete', url: '/statistics/1' },
        { method: 'get', url: '/statistics/paginate', params: { limit: 10, offset: 0 } },
        { method: 'get', url: '/statistics/search', params: { start_date: '2023-01-01', end_date: '2023-01-31' } },
        { method: 'get', url: '/statistics/searchByDate', params: { date: '2023-01-01' } },
        { method: 'get', url: '/testRunning' },
        { method: 'delete', url: '/deleteUsersBelowKills', params: { kills: 10 } },
    ];

    const results = [];
    let userId = null;

    for (const endpoint of endpoints) {
        try {
            const response = await axios({
                method: endpoint.method,
                url: `http://localhost:${PORT}${endpoint.url}`,
                data: endpoint.data,
                params: endpoint.params
            });

            if (endpoint.url === '/createUser') {
                console.log('usercreate response: ', response.data.insertId.toString());
                userId = response.data.insertId.toString(); // Assuming the response contains the created user's ID
                endpoints[5].data.user_id = userId;
                endpoints[6].data.user_id = userId;
                endpoints.push({ method: 'put', url: `/users/${userId}`, data: { username: `updateduser${currentTime}`, password: 'Updated1234', first_name: 'Updated', last_name: 'User' } });
                endpoints.push({ method: 'delete', url: `/users/${userId}` });
            }

            results.push({ endpoint: endpoint.url, method: endpoint.method, status: response.status });
        } catch (error) {
            results.push({ endpoint: endpoint.url, method: endpoint.method, status: error.response ? error.response.status : 'Error' });
            console.error('error: ', error.response ? error.response.data : error.message);
        }
    }

    res.json(results);
});

// https.createServer(app).listen(PORT, () => {
//     console.log(`HTTPS server running on port ${PORT}`);
// });

http.createServer(app).listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
});