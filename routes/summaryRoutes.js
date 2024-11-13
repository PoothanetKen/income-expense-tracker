const express = require('express');
const router = express.Router();
const { exportSummary, summary} = require('../controllers/summaryController');

router.get('/export', exportSummary); // export หน้าสรุปออก
router.get('/getSummary', summary); // สรุปยอดใช้จ่าย

module.exports = router;