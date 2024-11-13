const { pool } = require('../db');
const { getSessionUser } = require('../utils/sessionUtils');
const { handleError } = require('../utils/errorHandler');

// ฟังก์ชันสร้างบัญชี
exports.createAccount = async (req, res) => {
    const { accountName, balance } = req.body;

    // ตรวจสอบข้อมูลที่รับมา
    if (!accountName || balance === undefined) return handleError(res, 400, 'Please provide accountName and balance');
    if (isNaN(balance) || balance < 0) return handleError(res, 400, 'Invalid balance value. It must be a non-negative number.');

    // ตรวจสอบ session
    const sessionId = req.cookies.sessionId;
    if (!sessionId) return handleError(res, 401, 'Not authenticated');

    try {
        // ดึง user_id จาก session
        const userId = await getSessionUser(sessionId);

        // คำสั่ง SQL สร้างบัญชี
        const insertAccountQuery = 'INSERT INTO accounts (user_id, account_name, balance) VALUES ($1, $2, $3) RETURNING *';
        const result = await pool.query(insertAccountQuery, [userId, accountName, balance]);
        res.status(201).json({ message: 'Account created successfully', account: result.rows[0] });
    } catch (err) {
        console.error(err);
        handleError(res, 500, 'Server error');
    }
};

//ฟังก์ชันลบบบัญชี
exports.deleteAccount = async (req, res) => {
    const { accountId } = req.params;
    if (!accountId) return handleError(res, 400, 'Please provide an account ID');

    const sessionId = req.cookies.sessionId;
    if (!sessionId) return handleError(res, 401, 'Not authenticated');

    try {
        // ดึง user_id จาก session
        const userId = await getSessionUser(sessionId);

        // ตรวจสอบว่าบัญชีนี้เป็นของผู้ใช้มั้ย
        const checkAccountQuery = 'SELECT * FROM accounts WHERE account_id = $1 AND user_id = $2';
        const accountResult = await pool.query(checkAccountQuery, [accountId, userId]);

        if (accountResult.rows.length === 0) return handleError(res, 404, 'Account not found or does not belong to this user');

        // คำสั่ง SQL สำหรับลบบัญชี
        const deleteAccountQuery = 'DELETE FROM accounts WHERE account_id = $1 RETURNING *';
        const deleteResult = await pool.query(deleteAccountQuery, [accountId]);

        if (deleteResult.rows.length === 0) return handleError(res, 500, 'Failed to delete the account');

        res.status(200).json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error(err);
        handleError(res, 500, 'Server error');
    }
};