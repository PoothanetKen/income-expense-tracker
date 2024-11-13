const { pool } = require('../db');
const { filterBadWords } = require('../utils/filterObsceneWords');
const { getSessionUser } = require('../utils/sessionUtils');
const { handleError } = require('../utils/errorHandler');
const upload = require('../config/uploadConfig');


// ฟังก์ชันสร้างการทำรายการใหม่
exports.createTransaction = async (req, res) => {
    const { accountId, transaction_type, amount, description } = req.body;
    const transactionSlip = req.file ? req.file.filename : null;  // Handle file upload

    // แปลงและตรวจสอบ amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) return handleError(res, 400, 'Invalid amount');

    // ตรวจสอบ sessionId ว่ามีอยู่ใน cookies มั้ย
    const sessionId = req.cookies.sessionId;
    if (!sessionId) return handleError(res, 401, 'Not authenticated');

    // ตรวจสอบ description
    if (!description || description.length > 255) {
        return handleError(res, 400, 'Description is required and should not exceed 255 characters');
    }


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

        // กรองคำหยาบใน description
        const filteredDescription = filterBadWords(description);

        // อัปเดตยอดเงินในบัญชี
        const updateBalanceQuery = 'UPDATE accounts SET balance = $1 WHERE account_id = $2 RETURNING *';
        await pool.query(updateBalanceQuery, [newBalance, accountId]);

        // บันทึกธุรกรรมในฐานข้อมูล
        const insertTransactionQuery = `
            INSERT INTO transactions (user_id, account_id, transaction_type, amount, description, transaction_slip) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;

        await pool.query(insertTransactionQuery, [userId, accountId, transaction_type, parsedAmount, filteredDescription, transactionSlip]);

        res.status(200).json({ message: 'Transaction successful', newBalance });
    } catch (err) {
        console.error(err);
        handleError(res, 500, 'Server error');
    }
};

// ฟังก์ชันดึงข้อมูลธุรกรรม
exports.filterTransactions = async (req, res) => {
    const { accountId, type, startDate, endDate, page = 1, limit = 10 } = req.query;

    // ตรวจสอบว่า limit 
    const validLimits = [10, 20, 50, 100];  // กำหนดค่า limit ที่สามารถเลือกได้
    if (!validLimits.includes(Number(limit))) {
        return res.status(400).json({ message: 'Invalid limit value. Please select 10, 20, 50, or 100.' });
    }

    // ตรวจสอบว่า startDate และ endDate 
    if (startDate && isNaN(Date.parse(startDate))) {
        return res.status(400).json({ message: 'Invalid startDate format. Please use "YYYY-MM-DD".' });
    }

    if (endDate && isNaN(Date.parse(endDate))) {
        return res.status(400).json({ message: 'Invalid endDate format. Please use "YYYY-MM-DD".' });
    }

    // ตรวจสอบว่า accountId 
    if (accountId && isNaN(accountId)) {
        return res.status(400).json({ message: 'Invalid accountId. It should be a valid number.' });
    }

    // ตรวจสอบว่า type (transactionType) 
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

        // คำนวณ offset สำหรับ pagination
        const offset = (page - 1) * limit;

        
        query += ' ORDER BY transaction_date DESC LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2);

       
        queryParams.push(limit, offset);

  
        const result = await pool.query(query, queryParams);

 
        res.status(200).json({
            transactions: result.rows,
            page: Number(page),
            limit: Number(limit),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};
