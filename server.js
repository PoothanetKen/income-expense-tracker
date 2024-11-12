// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
// ตั้งค่า CORS
const corsOptions = {
  origin: 'http://localhost:5173',  // หรือ '*' เพื่ออนุญาตทุกแหล่งที่มา
  methods: ['GET', 'POST', 'PUT', 'DELETE'],  // ระบุเมธอดที่อนุญาต
  allowedHeaders: ['Content-Type', 'Authorization'],  // ระบุ header ที่อนุญาต
  credentials: true,  // ถ้าใช้ cookies
};

app.use(cors(corsOptions)); // ใช้ CORS middleware
app.use(bodyParser.json());

app.use(cookieParser());

// กำหนดเส้นทาง API
app.use('/api/auth', authRoutes);

// เริ่มเซิร์ฟเวอร์
app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
