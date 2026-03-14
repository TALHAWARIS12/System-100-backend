const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  getRooms,
  getMessages,
  sendMessage,
  deleteMessage,
  pinMessage,
  createRoom,
  toggleBan,
  uploadFile
} = require('../controllers/chatController');

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'chat'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext || mime);
  }
});

// Public room list
router.get('/rooms', protect, getRooms);

// Messages
router.get('/rooms/:roomId/messages', protect, getMessages);
router.post('/rooms/:roomId/messages', protect, sendMessage);

// File upload
router.post('/upload', protect, upload.single('file'), uploadFile);

// Admin actions
router.post('/rooms', protect, authorize('admin'), createRoom);
router.delete('/messages/:messageId', protect, deleteMessage);
router.put('/messages/:messageId/pin', protect, authorize('admin'), pinMessage);
router.put('/users/:userId/ban', protect, authorize('admin'), toggleBan);

module.exports = router;
