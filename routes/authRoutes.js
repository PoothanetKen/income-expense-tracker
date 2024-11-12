const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { filterObsceneWords } = require('../utils/filterObsceneWords');  // Moved obscene words filter to a separate file
const { Parser } = require('json2csv');
const XLSX = require('xlsx');
const { stringify } = require('csv-stringify');
const ExcelJS = require('exceljs');

const router = express.Router();


// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'upload/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);
        return extname && mimetype ? cb(null, true) : cb(new Error('File type is not supported'));
    }
});

// Centralized error handling function
const handleError = (res, status, message) => res.status(status).json({ message });

const getSessionUser = async (sessionId) => {
    try {
        const sessionQuery = 'SELECT * FROM sessions WHERE session_id = $1';
        const sessionResult = await pool.query(sessionQuery, [sessionId]);
        if (sessionResult.rows.length === 0) throw new Error('Invalid session');
        return sessionResult.rows[0].user_id;
    } catch (error) {
        throw new Error('Session expired or invalid');
    }
};

// Register Route
router.post('/register', async (req, res) => {
    const { fname, lname, email, password } = req.body;

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) return handleError(res, 400, 'Invalid email format');

    if (password.length < 8) return handleError(res, 400, 'Password must be at least 8 characters');



    if (!fname || !lname || !email || !password) return handleError(res, 400, 'Please provide all required fields');

    try {
        const userCheckQuery = 'SELECT * FROM users WHERE email = $1';
        const userCheckResult = await pool.query(userCheckQuery, [email]);

        if (userCheckResult.rows.length > 0) return handleError(res, 400, 'Email already registered');

        const hashedPassword = await bcrypt.hash(password, 10);
        const insertUserQuery = 'INSERT INTO users (fname, lname, email, password) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(insertUserQuery, [fname, lname, email, hashedPassword]);

        const sessionId = uuidv4();
        const insertSessionQuery = 'INSERT INTO sessions (session_id, user_id) VALUES ($1, $2)';
        await pool.query(insertSessionQuery, [sessionId, result.rows[0].id]);

        res.cookie('sessionId', sessionId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 3600000 });
        res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } catch (err) {
        console.error("Error during registration:", err);
        handleError(res, 500, 'Server error');
    }
});

// Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return handleError(res, 400, 'Please provide email and password');

    try {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await pool.query(query, [email]);

        if (result.rows.length === 0) return handleError(res, 400, 'Invalid credentials');

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) return handleError(res, 400, 'Incorrect password');

        const sessionId = uuidv4();
        const insertSessionQuery = 'INSERT INTO sessions (session_id, user_id) VALUES ($1, $2)';
        await pool.query(insertSessionQuery, [sessionId, user.id]);

        res.cookie('sessionId', sessionId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 3600000 });
        res.status(200).json({ message: 'Login successful' });
    } catch (err) {
        console.error(err);
        handleError(res, 500, 'Server error');
    }
});

// Create Account Route
router.post('/accounts', async (req, res) => {
    const { accountName, balance } = req.body;

    if (!accountName || balance === undefined) return handleError(res, 400, 'Please provide accountName and balance');
    if (isNaN(balance) || balance < 0) return handleError(res, 400, 'Invalid balance value. It must be a non-negative number.');

    const sessionId = req.cookies.sessionId;
    if (!sessionId) return handleError(res, 401, 'Not authenticated');

    try {
        const userId = await getSessionUser(sessionId);
        const insertAccountQuery = 'INSERT INTO accounts (user_id, account_name, balance) VALUES ($1, $2, $3) RETURNING *';
        const result = await pool.query(insertAccountQuery, [userId, accountName, balance]);
        res.status(201).json({ message: 'Account created successfully', account: result.rows[0] });
    } catch (err) {
        console.error(err);
        handleError(res, 500, 'Server error');
    }
});

// Delete Account Route
router.delete('/accounts/:accountId', async (req, res) => {
    const { accountId } = req.params;
    if (!accountId) return handleError(res, 400, 'Please provide an account ID');

    const sessionId = req.cookies.sessionId;
    if (!sessionId) return handleError(res, 401, 'Not authenticated');

    try {
        const userId = await getSessionUser(sessionId);
        const checkAccountQuery = 'SELECT * FROM accounts WHERE account_id = $1 AND user_id = $2';
        const accountResult = await pool.query(checkAccountQuery, [accountId, userId]);

        if (accountResult.rows.length === 0) return handleError(res, 404, 'Account not found or does not belong to this user');

        const deleteAccountQuery = 'DELETE FROM accounts WHERE account_id = $1 RETURNING *';
        const deleteResult = await pool.query(deleteAccountQuery, [accountId]);

        if (deleteResult.rows.length === 0) return handleError(res, 500, 'Failed to delete the account');

        res.status(200).json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error(err);
        handleError(res, 500, 'Server error');
    }
});

// Transactions Route
router.post('/transactions', upload.single('transactionSlip'), async (req, res) => {
    const { accountId, transaction_type, amount, description } = req.body;
    const transactionSlip = req.file ? req.file.filename : null;  // Handle file upload

    // ตรวจสอบ amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) return handleError(res, 400, 'Invalid amount');

    // ตรวจสอบ sessionId
    const sessionId = req.cookies.sessionId;
    if (!sessionId) return handleError(res, 401, 'Not authenticated');

    // ตรวจสอบ description
    if (!description || description.length > 255) {
        return handleError(res, 400, 'Description is required and should not exceed 255 characters');
    }

    // ตรวจสอบประเภทไฟล์ที่อัปโหลด

    try {
        const userId = await getSessionUser(sessionId);

        // ตรวจสอบบัญชีที่ผู้ใช้เลือก
        const checkAccountQuery = 'SELECT * FROM accounts WHERE account_id = $1 AND user_id = $2';
        const accountResult = await pool.query(checkAccountQuery, [accountId, userId]);

        if (!accountResult.rows || accountResult.rows.length === 0) {
            return handleError(res, 404, 'Account not found or does not belong to this user');
        }

        const currentBalance = parseFloat(accountResult.rows[0].balance);
        let newBalance;

        // ประเภทของธุรกรรม (income หรือ expense)
        if (transaction_type === 'income') {
            if (parsedAmount <= 0) return handleError(res, 400, 'Income amount must be positive');
            newBalance = currentBalance + parsedAmount;
        } else if (transaction_type === 'expense') {
            if (parsedAmount <= 0) return handleError(res, 400, 'Expense amount must be positive');
            if (currentBalance < parsedAmount) return handleError(res, 400, 'Insufficient balance');
            newBalance = currentBalance - parsedAmount;
        } else {
            return handleError(res, 400, 'Invalid transaction type');
        }

        // กรองคำไม่เหมาะสมใน description
        const filteredDescription = filterObsceneWords(description);

        // อัปเดตยอดเงินในบัญชี
        const updateBalanceQuery = 'UPDATE accounts SET balance = $1 WHERE account_id = $2 RETURNING *';
        await pool.query(updateBalanceQuery, [newBalance, accountId]);

        // บันทึกธุรกรรมในฐานข้อมูล
        const insertTransactionQuery = `
            INSERT INTO transactions (account_id, transaction_type, amount, description, transaction_slip) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *`;

        await pool.query(insertTransactionQuery, [accountId, transaction_type, parsedAmount, filteredDescription, transactionSlip]);

        res.status(200).json({ message: 'Transaction successful', newBalance });
    } catch (err) {
        console.error(err);
        handleError(res, 500, 'Server error');
    }
});

router.get('/transactions', async (req, res) => {
    const { accountId, type, startDate, endDate, page = 1, limit = 10 } = req.query;

    // ตรวจสอบว่า limit เป็นค่าที่ถูกต้องหรือไม่
    const validLimits = [10, 20, 50, 100];  // กำหนดค่า limit ที่สามารถเลือกได้
    if (!validLimits.includes(Number(limit))) {
        return res.status(400).json({ message: 'Invalid limit value. Please select 10, 20, 50, or 100.' });
    }

    // ตรวจสอบว่า startDate และ endDate เป็นวันที่ที่ถูกต้องหรือไม่
    if (startDate && isNaN(Date.parse(startDate))) {
        return res.status(400).json({ message: 'Invalid startDate format. Please use "YYYY-MM-DD".' });
    }

    if (endDate && isNaN(Date.parse(endDate))) {
        return res.status(400).json({ message: 'Invalid endDate format. Please use "YYYY-MM-DD".' });
    }

    // ตรวจสอบว่า accountId เป็นหมายเลขที่ถูกต้องหรือไม่
    if (accountId && isNaN(accountId)) {
        return res.status(400).json({ message: 'Invalid accountId. It should be a valid number.' });
    }

    // ตรวจสอบว่า type (transactionType) เป็นค่าที่ถูกต้องหรือไม่
    if (type && !['income', 'expense'].includes(type)) {
        return res.status(400).json({ message: 'Invalid transaction type. Allowed values are "income" or "expense".' });
    }

    // ดึง sessionId จาก cookies เพื่อตรวจสอบการล็อกอิน
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        // ตรวจสอบ session และดึง userId จากฐานข้อมูล
        const sessionQuery = 'SELECT * FROM sessions WHERE session_id = $1';
        const sessionResult = await pool.query(sessionQuery, [sessionId]);

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ message: 'Session expired or invalid' });
        }

        const userId = sessionResult.rows[0].user_id;

        // สร้าง query ที่เชื่อมโยงกับ userId และ accountId
        let query = 'SELECT * FROM transactions t JOIN accounts a ON t.account_id = a.account_id WHERE a.user_id = $1'; // เพิ่มการเชื่อมโยงกับ accounts
        let queryParams = [userId];

        // Filter การค้นหาตาม accountId, type, startDate, endDate
        if (accountId) {
            queryParams.push(accountId);
            query += ` AND t.account_id = $${queryParams.length}`;
        }

        if (type) {
            queryParams.push(type);
            query += ` AND t.transaction_type = $${queryParams.length}`;
        }

        if (startDate && endDate) {
            queryParams.push(startDate, endDate);
            query += ` AND transaction_date BETWEEN $${queryParams.length - 1} AND $${queryParams.length}`;
        } else if (startDate) {
            queryParams.push(startDate);
            query += ` AND transaction_date >= $${queryParams.length}`;
        } else if (endDate) {
            queryParams.push(endDate);
            query += ` AND transaction_date <= $${queryParams.length}`;
        }

        // คำนวณ OFFSET สำหรับ pagination
        const offset = (page - 1) * limit;

        // เพิ่ม LIMIT และ OFFSET ใน query
        query += ' ORDER BY transaction_date DESC LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2);

        // เพิ่มค่าของ LIMIT และ OFFSET ลงใน queryParams
        queryParams.push(limit, offset);

        // ดึงข้อมูลจากฐานข้อมูล
        const result = await pool.query(query, queryParams);

        // ส่งข้อมูลพร้อมจำนวนรายการทั้งหมด
        res.status(200).json({
            transactions: result.rows,
            page: Number(page),
            limit: Number(limit),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});




// Summary Route
router.get('/expenses/summary/export', async (req, res) => {
    const { startDate, endDate, accountId, transactionType, format } = req.query;
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        // ตรวจสอบ session และดึง userId จากฐานข้อมูล
        const sessionQuery = 'SELECT * FROM sessions WHERE session_id = $1';
        const sessionResult = await pool.query(sessionQuery, [sessionId]);

        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ message: 'Session expired or invalid' });
        }

        const userId = sessionResult.rows[0].user_id;

        let query = 'SELECT transaction_type, SUM(amount) AS total_amount FROM transactions t JOIN accounts a ON t.account_id = a.account_id WHERE a.user_id = $1';
        let queryParams = [userId];

        if (accountId) {
            queryParams.push(accountId);
            query += ` AND t.account_id = $${queryParams.length}`;
        }

        if (transactionType) {
            queryParams.push(transactionType);
            query += ` AND t.transaction_type = $${queryParams.length}`;
        }

        if (startDate && endDate) {
            queryParams.push(startDate, endDate);
            query += ` AND transaction_date BETWEEN $${queryParams.length - 1} AND $${queryParams.length}`;
        } else if (startDate) {
            queryParams.push(startDate);
            query += ` AND transaction_date >= $${queryParams.length}`;
        } else if (endDate) {
            queryParams.push(endDate);
            query += ` AND transaction_date <= $${queryParams.length}`;
        }

        query += ' GROUP BY transaction_type ORDER BY transaction_type';

        const result = await pool.query(query, queryParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No transactions found for the given criteria' });
        }

        // สร้างผลลัพธ์การสรุปยอด
        const summary = result.rows.map(row => ({
            transactionType: row.transaction_type,
            totalAmount: row.total_amount || 0,
        }));

        // เลือกฟอร์แมตที่ต้องการ (CSV, Excel, JSON)
        if (format === 'csv') {
            const json2csvParser = new Parser();
            const csv = json2csvParser.parse(summary);
            res.header('Content-Type', 'text/csv');
            res.attachment('transactions_summary.csv');
            return res.send(csv);
        }

        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(summary);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Summary');
            const excelFile = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.attachment('transactions_summary.xlsx');
            return res.send(excelFile);
        }

        if (format === 'json') {
            return res.json({
                message: 'Transaction summary retrieved successfully',
                summary: summary,
            });
        }

        // ถ้าไม่เลือกฟอร์แมตใดๆ
        return res.status(400).json({ message: 'Invalid format specified. Please specify csv, excel, or json.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;
