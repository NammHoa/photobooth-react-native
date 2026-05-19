const express = require('express');
const multer = require('multer');
const path = require('path');
const Photo = require('../models/Photo');

const router = express.Router();

// Cấu hình Multer để lưu file tải lên vào thư mục 'uploads/'
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// API: Tải ảnh lên và lưu vào MongoDB
router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không tìm thấy file ảnh.' });
    }

    // Tạo URL để truy cập ảnh (dựa trên cấu hình static ở server.js)
    // Lưu ý: Trong thực tế khi deploy, hãy đổi 'localhost' thành tên miền của server
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    const photoUrl = `${serverUrl}/uploads/${req.file.filename}`;

    // Lưu thông tin vào MongoDB
    const newPhoto = new Photo({ photoUrl });
    await newPhoto.save();

    res.status(201).json({
      message: 'Tải ảnh lên thành công',
      photo: newPhoto,
    });
  } catch (error) {
    console.error('Lỗi khi tải ảnh:', error);
    res.status(500).json({ error: 'Lỗi server khi tải ảnh' });
  }
});

// API: Lấy danh sách ảnh
router.get('/', async (req, res) => {
  try {
    const photos = await Photo.find().sort({ createdAt: -1 });
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server khi lấy ảnh' });
  }
});

module.exports = router;
