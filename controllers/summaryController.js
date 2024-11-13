const XLSX = require('xlsx');
const { pool } = require('../db');
const { Parser } = require('json2csv');

// ฟังก์ชันสรุปยอดใช้จ่าย
exports.summary = async (req, res) => {
    const { startDate, endDate, accountId, transactionType } = req.query;

    // Validate startDate และ endDate (รูปแบบ YYYY-MM-DD)
    if (startDate && isNaN(Date.parse(startDate))) {
        return res.status(400).json({ message: 'Invalid startDate format. Please use "YYYY-MM-DD".' });
    }

    if (endDate && isNaN(Date.parse(endDate))) {
        return res.status(400).json({ message: 'Invalid endDate format. Please use "YYYY-MM-DD".' });
    }

    // Validate accountId (ต้องเป็นตัวเลข)
    if (accountId && isNaN(accountId)) {
        return res.status(400).json({ message: 'Invalid accountId. It should be a valid number.' });
    }

    // Validate transactionType (ต้องเป็น "income" หรือ "expense")
    if (transactionType && !['income', 'expense'].includes(transactionType)) {
        return res.status(400).json({ message: 'Invalid transactionType. Allowed values are "income" or "expense".' });
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
        let query = 'SELECT transaction_type, SUM(amount) AS total_amount FROM transactions t JOIN accounts a ON t.account_id = a.account_id WHERE a.user_id = $1';
        let queryParams = [userId]; // ใช้ userId ที่ได้จาก session

        
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

        query += ' GROUP BY transaction_type ORDER BY transaction_type';  // แบ่งผลลัพธ์ตามประเภท

        const result = await pool.query(query, queryParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No transactions found for the given criteria' });
        }

        // สรุปยอด
        const summary = result.rows.map(row => ({
            transactionType: row.transaction_type,  
            totalAmount: row.total_amount || 0,  
        }));

        res.status(200).json({
            message: 'Transaction summary retrieved successfully',
            summary: summary,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ฟังก์ชัน export ของหน้าสรุปผลออกมาเป็น excel, csv และ JSON
exports.exportSummary = async (req, res) => {
    const { startDate, endDate, accountId, format } = req.query;
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

        // สร้าง query สำหรับดึงข้อมูลธุรกรรม 
        let query = 'SELECT t.transaction_type, t.amount, t.transaction_date, t.description FROM transactions t JOIN accounts a ON t.account_id = a.account_id WHERE a.user_id = $1';
        let queryParams = [userId];

        
        if (accountId) {
            queryParams.push(accountId);
            query += ` AND t.account_id = $${queryParams.length}`;
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

        query += ' ORDER BY t.transaction_date'; // สั่งให้เรียงตามวันที่

        // ดึงข้อมูลจากฐานข้อมูล
        const result = await pool.query(query, queryParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No transactions found for the given criteria' });
        }

        // สรุปรายการธุรกรรม
        const transactions = result.rows.map(row => ({
            transactionType: row.transaction_type,
            amount: row.amount,
            transactionDate: row.transaction_date,
            description: row.description || 'No description',
        }));

        // เลือกฟอร์แมตที่ต้องการ (CSV, Excel, JSON)
        if (format === 'csv') {
            const json2csvParser = new Parser();
            const csv = json2csvParser.parse(transactions);
            res.header('Content-Type', 'text/csv');
            res.attachment('transactions_summary.csv');
            return res.send(csv);
        }

        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(transactions);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
            const excelFile = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.attachment('transactions_summary.xlsx');
            return res.send(excelFile);
        }

        if (format === 'json') {
            return res.json({
                message: 'Transactions retrieved successfully',
                transactions: transactions,
            });
        }

        return res.status(400).json({ message: 'Invalid format specified. Please specify csv, excel, or json.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};
