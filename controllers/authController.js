const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { handleError } = require('../utils/errorHandler');

//ฟังก์ชัน register
exports.register =  async (req, res) => {
    const { fname, lname, email, password } = req.body;

    // ตรวจสอบรูปแบบเมล ความยาวรหัสผ่าน และกรอกข้อมูลครบมั้ย
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) return handleError(res, 400, 'Invalid email format');
    if (password.length < 8) return handleError(res, 400, 'Password must be at least 8 characters');
    if (!fname || !lname || !email || !password) return handleError(res, 400, 'Please provide all required fields');

    try {
        // ตรวจสอบว่ามีเมลอยู่ในฐานข้อมูลมั้ย
        const userCheckQuery = 'SELECT * FROM users WHERE email = $1';
        const userCheckResult = await pool.query(userCheckQuery, [email]);
        if (userCheckResult.rows.length > 0) return handleError(res, 400, 'Email already registered');

        // เข้ารหัสรหัสผ่านและเพิ่มผู้ใช้ในฐานข้อมูล
        const hashedPassword = await bcrypt.hash(password, 10);
        const insertUserQuery = 'INSERT INTO users (fname, lname, email, password) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(insertUserQuery, [fname, lname, email, hashedPassword]);

        // สร้าง session และเพิ่มลงในฐานข้อมูล
        const sessionId = uuidv4();
        const insertSessionQuery = 'INSERT INTO sessions (session_id, user_id) VALUES ($1, $2)';
        await pool.query(insertSessionQuery, [sessionId, result.rows[0].id]);

        // ตั้งค่า cookies สำหรับ session
        res.cookie('sessionId', sessionId, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 3600000 
        });

        res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } catch (err) {
        console.error("Error during registration:", err);
        handleError(res, 500, 'Server error');
    }
};


// ฟังก์ชันเข้าสู่ระบบ
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return handleError(res, 400, 'Please provide email and password');

    try {
        // ตรวจสอบผู้ใช้ด้วยเมล
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await pool.query(query, [email]);
        if (result.rows.length === 0) return handleError(res, 400, 'Invalid credentials');

        const user = result.rows[0];

        // ตรวจสอบรหัสผ่าน
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return handleError(res, 400, 'Incorrect password');

        // สร้าง session ใหม่
        const sessionId = uuidv4();
        const insertSessionQuery = 'INSERT INTO sessions (session_id, user_id) VALUES ($1, $2)';
        await pool.query(insertSessionQuery, [sessionId, user.id]);

        res.cookie('sessionId', sessionId, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 3600000 
        });
        
        res.status(200).json({ message: 'Login successful' });
    } catch (err) {
        console.error(err);
        handleError(res, 500, 'Server error');
    }
};

exports.logout = async (req, res) => {
    try {
        // ลบ session ในฐานข้อมูล
        const sessionId = req.cookies.sessionId; // ใช้ sessionId ที่เก็บในคุกกี้
        if (!sessionId) return handleError(res, 400, 'No session found');

        const deleteSessionQuery = 'DELETE FROM sessions WHERE session_id = $1';
        await pool.query(deleteSessionQuery, [sessionId]);

        // ลบคุกกี้ session
        res.clearCookie('sessionId');

        res.status(200).json({ message: 'Logout successful' });
    } catch (err) {
        console.error('Error during logout:', err);
        handleError(res, 500, 'Server error');
    }
};