// routes/auth.js
const express = require('express');
const router = express.Router();

const {
  register,
  login,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  updatePassword,
  getCurrentUser
} = require('../handlers/auth');

const {verifyToken,adminAuth} = require('../../../middlewares/authentication')

// Public routes
router.route('/register').post(register);
router.route('/login').post(login);
router.route('/verify-otp').post(verifyOTP);
router.route('/resend-otp').post(resendOTP);
router.route('/forgot-password').post(forgotPassword);
router.route('/reset-password').post(resetPassword);

// Protected routes
router.route('/update-password').post(verifyToken, updatePassword);
router.route('/me').get(verifyToken, getCurrentUser);

module.exports = router;