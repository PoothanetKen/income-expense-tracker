const express = require('express');
const { register, login, logout } = require('../controllers/authController');
const router = express.Router();

router.post('/register', register); // สมัครสมาชิก
router.post('/login', login); // เข้าสู่ระบบ
router.post('/logout', logout); // ออกจากระบบ


module.exports = router;
