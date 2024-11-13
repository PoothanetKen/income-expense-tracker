const { pool } = require('../db');

//ตรวจสอบ session และ ดึง user_id
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

module.exports = { getSessionUser };