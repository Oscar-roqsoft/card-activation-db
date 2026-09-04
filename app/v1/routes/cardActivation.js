// routes/cardActivation.js
const express = require('express');
const router = express.Router();

const {
  initiateActivation,
  confirmPayment,
  verifyOTP,
  resendOTP,
  approveActivation,
  rejectActivation,
  getUserActivations,
  getActivationDetails,
  completeActivation,
  // Admin functions
  getAllActivations,
  getPaymentConfirmations,
  getPendingApprovals,
  getActivationStats
} = require('../handlers/cardActivation');

const { verifyToken, adminAuth } = require('../../../middlewares/authentication');

// ============================================
// ADMIN ROUTES (Must come BEFORE parameterized routes)
// ============================================

// Get all activations (with pagination and status filter)
router.route('/admin/all')
  .get(verifyToken, adminAuth, getAllActivations);

// Get payment confirmations (with pagination and filter)
router.route('/admin/payments')
  .get(verifyToken, adminAuth, getPaymentConfirmations);

// Get pending approvals (otp_verified status)
router.route('/admin/pending')
  .get(verifyToken, adminAuth, getPendingApprovals);

// Get activation statistics
router.route('/admin/stats')
  .get(verifyToken, adminAuth, getActivationStats);

// ============================================
// USER ROUTES (Require authentication)
// ============================================

// Get user's own activations
router.route('/my-activations')
  .get(verifyToken, getUserActivations);

// Initiate card activation
router.route('/initiate')
  .post(verifyToken, initiateActivation);

// Verify OTP
router.route('/verify-otp')
  .post(verifyToken, verifyOTP);

// Resend OTP
router.route('/resend-otp')
  .post(verifyToken, resendOTP);

// ============================================
// PARAMETERIZED ROUTES (Must come LAST)
// ============================================

// Get activation details
router.route('/:activationId')
  .get(verifyToken, getActivationDetails);

// Confirm payment for activation
router.route('/:activationId/confirm-payment')
  .post(verifyToken, confirmPayment);

// Complete activation (user)
router.route('/:activationId/complete')
  .post(verifyToken, completeActivation);

// Approve activation (admin)
router.route('/:activationId/approve')
  .post(verifyToken, adminAuth, approveActivation);

// Reject activation (admin)
router.route('/:activationId/reject')
  .post(verifyToken, adminAuth, rejectActivation);

module.exports = router;