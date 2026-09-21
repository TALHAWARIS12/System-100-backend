const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validator');
const {
  registerValidation,
  loginValidation
} = require('../middleware/validation');
const {
  register,
  login,
  getMe,
  updatePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', registerValidation, register);

router.post('/login', loginValidation, login);

router.get('/me', protect, getMe);

router.post(
  '/forgot-password',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    validate
  ],
  forgotPassword
);

router.post(
  '/reset-password/:token',
  [
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    validate
  ],
  resetPassword
);

router.put(
  '/password',
  protect,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
    validate
  ],
  updatePassword
);

module.exports = router;
