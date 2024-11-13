const multer = require('multer');
const path = require('path');

// กำหนดการตั้งค่า storage สำหรับจัดเก็บไฟล์ที่อัปโหลด
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'upload/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});

// ตั้งค่า multer สำหรับจัดการอัปโหลดไฟล์
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);
        return extname && mimetype ? cb(null, true) : cb(new Error('File type is not supported'));
    }
});

module.exports = upload;