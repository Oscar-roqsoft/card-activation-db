// handlers/cardActivation.js 
const CardPlan = require('../models/CardPlan');
const CardActivation = require('../models/CardActivation');
const CoinWallet = require('../models/CoinWallet');
const User = require('../models/user');
const crypto = require('crypto');
const { sendCardActivationOTP, sendActivationApprovedEmail } = require('../../../utils/emailUtils');
const cache = require('../../../db/cache');

// Response helpers
const sendSuccess = (res, message, data) => {
  res.status(200).json({ success: true, message, data: data || null });
};

const sendError = (res, status, message) => {
  res.status(status).json({ success: false, error: message });
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/*
|--------------------------------------------------------------------------
| INITIATE CARD ACTIVATION
|--------------------------------------------------------------------------
*/
const initiateActivation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId, cardDetails,coin = null } = req.body;

    if (!planId || !cardDetails ) {
      return sendError(res, 400, 'Plan ID and card details are required');
    }

    // Validate plan
    const plan = await CardPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return sendError(res, 404, 'Card plan not available');
    }

    // Validate user
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Get wallet address for selected coin
    // const wallet = await CoinWallet.findOne({ coin, isActive: true });
    // if (!wallet) {
    //   return sendError(res, 404, `Wallet address for ${coin} not available`);
    // }

    // Check for existing pending activation
    const existing = await CardActivation.findOne({
      userId,
      status: { $in: ['pending', 'payment_confirmed', 'otp_verified'] }
    });

    if (existing) {
      return sendError(res, 409, 'You have a pending card activation. Please complete or cancel it.');
    }

    // Create activation record
    const activation = await CardActivation.create({
      userId,
      planId,
      cardDetails: {
        number: cardDetails.number.replace(/\s/g, ''),
        expiry: cardDetails.expiry,
        cvv: cardDetails.cvv,
        cardholderName: cardDetails.cardholderName
      },
      payment: {
        coin,
        amount: plan.fee,
      },
      status: 'pending'
    });

    // Generate OTP
    const otp = generateOTP();

    // Store OTP in cache
    const cacheKey = `activation_otp:${activation._id}`;
    cache.set(cacheKey, {
      otp,
      attempts: 0,
      userId: userId.toString()
    }, 600); // 10 minutes

    // Store OTP in activation record (for reference)
    activation.otp = {
      code: otp,
      verified: false,
      expiresAt: new Date(Date.now() + 600000),
      attempts: 0
    };
    await activation.save();

    // Send OTP email using the new email utility
    await sendCardActivationOTP(user, activation._id, otp);

    // Return safe data
    const safeActivation = {
      id: activation._id,
      plan: plan.displayName,
      fee: plan.fee,
      coin: activation.payment.coin,
      walletAddress: activation.payment.walletAddress,
      status: activation.status,
      createdAt: activation.createdAt
    };

    sendSuccess(res, 'Card activation initiated. OTP sent to your email.', {
      activation: safeActivation
    });
  } catch (error) {
    console.error('Initiate activation error:', error);
    sendError(res, 500, 'Failed to initiate card activation');
  }
};

/*
|--------------------------------------------------------------------------
| CONFIRM PAYMENT
|--------------------------------------------------------------------------
*/
const confirmPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { activationId } = req.params;

    const activation = await CardActivation.findOne({
      _id: activationId,
      userId
    });

    if (!activation) {
      return sendError(res, 404, 'Activation not found');
    }

    if (activation.status !== 'pending') {
      return sendError(res, 400, `Cannot confirm payment for status: ${activation.status}`);
    }

    // Update payment status
    activation.payment.confirmed = true;
    activation.payment.confirmedAt = new Date();
    activation.status = 'payment_confirmed';
    await activation.save();

    sendSuccess(res, 'Payment confirmed successfully', {
      activation: {
        id: activation._id,
        status: activation.status
      }
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    sendError(res, 500, 'Failed to confirm payment');
  }
};

/*
|--------------------------------------------------------------------------
| VERIFY OTP
|--------------------------------------------------------------------------
*/
const verifyOTP = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { activationId, otp } = req.body;

    if (!activationId || !otp) {
      return sendError(res, 400, 'Activation ID and OTP are required');
    }

    const activation = await CardActivation.findOne({
      _id: activationId,
      userId
    });

    if (!activation) {
      return sendError(res, 404, 'Activation not found');
    }

    if (activation.status !== 'payment_confirmed') {
      return sendError(res, 400, 'Payment must be confirmed before OTP verification');
    }

    // Check OTP from cache
    const cacheKey = `activation_otp:${activation._id}`;
    const cachedOTP = cache.get(cacheKey);

    if (!cachedOTP) {
      return sendError(res, 400, 'OTP expired. Please request a new one.');
    }

    // Check attempts
    if (cachedOTP.attempts >= 5) {
      cache.del(cacheKey);
      return sendError(res, 400, 'Too many failed attempts. Please request a new OTP.');
    }

    if (cachedOTP.otp !== otp) {
      cachedOTP.attempts++;
      cache.set(cacheKey, cachedOTP, 600);
      activation.otp.attempts = cachedOTP.attempts;
      await activation.save();
      return sendError(res, 400, 'Invalid OTP');
    }

    // OTP verified
    activation.otp.verified = true;
    activation.otp.verifiedAt = new Date();
    activation.status = 'otp_verified';
    await activation.save();

    // Clean up cache
    cache.del(cacheKey);

    sendSuccess(res, 'OTP verified successfully', {
      activation: {
        id: activation._id,
        status: activation.status
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    sendError(res, 500, 'Failed to verify OTP');
  }
};

/*
|--------------------------------------------------------------------------
| RESEND OTP
|--------------------------------------------------------------------------
*/
const resendOTP = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { activationId } = req.body;

    if (!activationId) {
      return sendError(res, 400, 'Activation ID is required');
    }

    const activation = await CardActivation.findOne({
      _id: activationId,
      userId
    });

    if (!activation) {
      return sendError(res, 404, 'Activation not found');
    }

    if (activation.status !== 'payment_confirmed') {
      return sendError(res, 400, 'Payment must be confirmed before requesting OTP');
    }

    // Generate new OTP
    const otp = generateOTP();
    const cacheKey = `activation_otp:${activation._id}`;

    // Store in cache
    cache.set(cacheKey, {
      otp,
      attempts: 0,
      userId: userId.toString()
    }, 600);

    // Update activation
    activation.otp.code = otp;
    activation.otp.attempts = 0;
    activation.otp.expiresAt = new Date(Date.now() + 600000);
    await activation.save();

    // Get user for email
    const user = await User.findById(userId);

    // Send OTP email
    await sendCardActivationOTP(user, activation._id, otp);

    sendSuccess(res, 'OTP resent successfully', null);
  } catch (error) {
    console.error('Resend OTP error:', error);
    sendError(res, 500, 'Failed to resend OTP');
  }
};

/*
|--------------------------------------------------------------------------
| APPROVE ACTIVATION (Admin only)
|--------------------------------------------------------------------------
*/
const approveActivation = async (req, res) => {
  try {
    const { activationId } = req.params;

    const activation = await CardActivation.findById(activationId).populate('userId', 'name email');
    if (!activation) {
      return sendError(res, 404, 'Activation not found');
    }

    if (activation.status !== 'otp_verified') {
      return sendError(res, 400, `Cannot approve activation with status: ${activation.status}`);
    }

    // Get plan details
    const plan = await CardPlan.findById(activation.planId);

    activation.status = 'approved';
    activation.approvedAt = new Date();
    await activation.save();

    // Send approval email
    await sendActivationApprovedEmail(activation.userId, plan.displayName);

    sendSuccess(res, 'Card activation approved', {
      activation: {
        id: activation._id,
        status: activation.status
      }
    });
  } catch (error) {
    console.error('Approve activation error:', error);
    sendError(res, 500, 'Failed to approve activation');
  }
};

/*
|--------------------------------------------------------------------------
| REJECT ACTIVATION (Admin only)
|--------------------------------------------------------------------------
*/
const rejectActivation = async (req, res) => {
  try {
    const { activationId } = req.params;
    const { reason } = req.body;

    const activation = await CardActivation.findById(activationId);
    if (!activation) {
      return sendError(res, 404, 'Activation not found');
    }

    if (activation.status === 'completed') {
      return sendError(res, 400, 'Cannot reject a completed activation');
    }

    activation.status = 'rejected';
    activation.rejectedAt = new Date();
    activation.rejectionReason = reason || 'No reason provided';
    await activation.save();

    sendSuccess(res, 'Card activation rejected', {
      activation: {
        id: activation._id,
        status: activation.status,
        reason: activation.rejectionReason
      }
    });
  } catch (error) {
    console.error('Reject activation error:', error);
    sendError(res, 500, 'Failed to reject activation');
  }
};

/*
|--------------------------------------------------------------------------
| GET USER ACTIVATIONS
|--------------------------------------------------------------------------
*/
const getUserActivations = async (req, res) => {
  try {
    const userId = req.user.userId;

    const activations = await CardActivation.find({ userId })
      .populate('planId', 'displayName fee color')
      .sort({ createdAt: -1 })
      .lean();

    // Remove sensitive data
    const safeActivations = activations.map(act => ({
      id: act._id,
      plan: act.planId,
      payment: {
        coin: act.payment.coin,
        amount: act.payment.amount,
        confirmed: act.payment.confirmed
      },
      status: act.status,
      createdAt: act.createdAt,
      approvedAt: act.approvedAt,
      completedAt: act.completedAt
    }));

    sendSuccess(res, 'User activations retrieved successfully', {
      activations: safeActivations
    });
  } catch (error) {
    console.error('Get user activations error:', error);
    sendError(res, 500, 'Failed to retrieve activations');
  }
};

/*
|--------------------------------------------------------------------------
| GET ACTIVATION DETAILS
|--------------------------------------------------------------------------
*/
const getActivationDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { activationId } = req.params;

    const activation = await CardActivation.findOne({
      _id: activationId,
      userId
    }).populate('planId', 'displayName fee color benefits features');

    if (!activation) {
      return sendError(res, 404, 'Activation not found');
    }

    // Remove sensitive data
    const safeActivation = {
      id: activation._id,
      plan: activation.planId,
      cardDetails: {
        expiry: activation.cardDetails.expiry,
        cardholderName: activation.cardDetails.cardholderName
      },
      payment: {
        coin: activation.payment.coin,
        amount: activation.payment.amount,
        walletAddress: activation.payment.walletAddress,
        confirmed: activation.payment.confirmed,
        confirmedAt: activation.payment.confirmedAt
      },
      status: activation.status,
      otpVerified: activation.otp.verified,
      createdAt: activation.createdAt,
      approvedAt: activation.approvedAt,
      completedAt: activation.completedAt
    };

    sendSuccess(res, 'Activation details retrieved successfully', {
      activation: safeActivation
    });
  } catch (error) {
    console.error('Get activation details error:', error);
    sendError(res, 500, 'Failed to retrieve activation details');
  }
};

/*
|--------------------------------------------------------------------------
| COMPLETE ACTIVATION (User)
|--------------------------------------------------------------------------
*/
const completeActivation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { activationId } = req.params;

    const activation = await CardActivation.findOne({
      _id: activationId,
      userId
    });

    if (!activation) {
      return sendError(res, 404, 'Activation not found');
    }

    if (activation.status !== 'approved') {
      return sendError(res, 400, 'Activation must be approved before completing');
    }

    activation.status = 'completed';
    activation.completedAt = new Date();
    await activation.save();

    sendSuccess(res, 'Card activation completed successfully', {
      activation: {
        id: activation._id,
        status: activation.status
      }
    });
  } catch (error) {
    console.error('Complete activation error:', error);
    sendError(res, 500, 'Failed to complete activation');
  }
};

module.exports = {
  initiateActivation,
  confirmPayment,
  verifyOTP,
  resendOTP,
  approveActivation,
  rejectActivation,
  getUserActivations,
  getActivationDetails,
  completeActivation
};