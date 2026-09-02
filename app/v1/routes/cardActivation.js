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
  completeActivation
} = require('../handlers/cardActivation');

const { verifyToken, adminAuth } = require('../../../middlewares/authentication');

// Protected routes (require authentication)
router.route('/initiate').post(verifyToken, initiateActivation);
router.route('/:activationId/confirm-payment').post(verifyToken, confirmPayment);
router.route('/verify-otp').post(verifyToken, verifyOTP);
router.route('/resend-otp').post(verifyToken, resendOTP);
router.route('/my-activations').get(verifyToken, getUserActivations);
router.route('/:activationId').get(verifyToken, getActivationDetails);
router.route('/:activationId/complete').post(verifyToken, completeActivation);

// Admin routes
router.route('/:activationId/approve').post(verifyToken, adminAuth, approveActivation);
router.route('/:activationId/reject').post(verifyToken, adminAuth, rejectActivation);

module.exports = router;