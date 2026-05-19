require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const photoRoutes = require('./routes/photoRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Biến thư mục 'uploads' thành public để có thể truy cập bằng trình duyệt/app
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/photos', photoRoutes);

// Test Route
app.get('/', (req, res) => {
  res.send('Photobooth API is running!');
});

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
