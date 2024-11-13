const express = require('express');
const { createAccount, deleteAccount } = require('../controllers/accountController');
const router = express.Router();

router.post('/create', createAccount); // สร้างบัญชีสำหรับ รายรัย - รายจ่าย
router.delete('/delete/:accountId', deleteAccount); // ลบบัญชี

module.exports = router;
