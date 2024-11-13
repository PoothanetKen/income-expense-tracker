const express = require('express');
const router = express.Router();
const { createTransaction, filterTransactions } = require('../controllers/transactionController');
const upload = require('../config/uploadConfig');

router.post('/addTransaction', upload.single('transactionSlip'), createTransaction); // สร้างธุรกกรม
router.get('/filterTransactions', filterTransactions); // ระบบ filter 

module.exports = router;