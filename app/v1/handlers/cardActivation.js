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


const getAllActivations = async (req, res) => {
  try {
    // Check if user is admin
    const admin = await User.findById(req.user.userId).select('role');
    if (!admin || admin.role !== 'admin') {
      return sendError(res, 403, 'Admin access required');
    }

    const { status, page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = {};
    if (status) {
      filter.status = status;
    }

    // Get activations with pagination
    const activations = await CardActivation.find(filter)
      .populate('userId', 'name email country walletAddress')
      .populate('planId', 'displayName fee color')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await CardActivation.countDocuments(filter);

    // Remove sensitive data
    const safeActivations = activations.map(act => ({
      id: act._id,
      user: {
        id: act.userId?._id,
        name: act.userId?.name,
        email: act.userId?.email,
        country: act.userId?.country,
        walletAddress: act.userId?.walletAddress
      },
      plan: {
        id: act.planId?._id,
        displayName: act.planId?.displayName,
        fee: act.planId?.fee,
        color: act.planId?.color
      },
      cardDetails: {
        expiry: act.cardDetails?.expiry,
        cardholderName: act.cardDetails?.cardholderName
      },
      payment: {
        coin: act.payment?.coin,
        amount: act.payment?.amount,
        confirmed: act.payment?.confirmed,
        confirmedAt: act.payment?.confirmedAt,
        walletAddress: act.payment?.walletAddress
      },
      otp: {
        verified: act.otp?.verified,
        verifiedAt: act.otp?.verifiedAt
      },
      status: act.status,
      createdAt: act.createdAt,
      approvedAt: act.approvedAt,
      rejectedAt: act.rejectedAt,
      rejectionReason: act.rejectionReason,
      completedAt: act.completedAt
    }));

    sendSuccess(res, 'All activations retrieved successfully', {
      activations: safeActivations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all activations error:', error);
    sendError(res, 500, 'Failed to retrieve activations');
  }
};

/*
|--------------------------------------------------------------------------
| GET PAYMENT CONFIRMATIONS (Admin only)
|--------------------------------------------------------------------------
*/
const getPaymentConfirmations = async (req, res) => {
  try {
    // Check if user is admin
    const admin = await User.findById(req.user.userId).select('role');
    if (!admin || admin.role !== 'admin') {
      return sendError(res, 403, 'Admin access required');
    }

    const { confirmed, page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = {};
    if (confirmed !== undefined) {
      filter['payment.confirmed'] = confirmed === 'true';
    }

    // Get activations with payment data
    const activations = await CardActivation.find(filter)
      .populate('userId', 'name email country walletAddress')
      .populate('planId', 'displayName fee color')
      .sort({ 'payment.confirmedAt': -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await CardActivation.countDocuments(filter);

    // Prepare safe data
    const payments = activations.map(act => ({
      id: act._id,
      user: {
        id: act.userId?._id,
        name: act.userId?.name,
        email: act.userId?.email,
        country: act.userId?.country,
        walletAddress: act.userId?.walletAddress
      },
      plan: {
        id: act.planId?._id,
        displayName: act.planId?.displayName,
        fee: act.planId?.fee
      },
      payment: {
        coin: act.payment?.coin,
        amount: act.payment?.amount,
        confirmed: act.payment?.confirmed,
        confirmedAt: act.payment?.confirmedAt,
        walletAddress: act.payment?.walletAddress
      },
      status: act.status,
      createdAt: act.createdAt,
      approvedAt: act.approvedAt,
      completedAt: act.completedAt
    }));

    sendSuccess(res, 'Payment confirmations retrieved successfully', {
      payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get payment confirmations error:', error);
    sendError(res, 500, 'Failed to retrieve payment confirmations');
  }
};

/*
|--------------------------------------------------------------------------
| GET PENDING APPROVALS (Admin only)
|--------------------------------------------------------------------------
*/
const getPendingApprovals = async (req, res) => {
  try {
    // Check if user is admin
    const admin = await User.findById(req.user.userId).select('role');
    if (!admin || admin.role !== 'admin') {
      return sendError(res, 403, 'Admin access required');
    }

    const { page = 1, limit = 20 } = req.query;

    // Get activations pending approval (otp_verified status)
    const activations = await CardActivation.find({ status: 'otp_verified' })
      .populate('userId', 'name email country walletAddress')
      .populate('planId', 'displayName fee color')
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await CardActivation.countDocuments({ status: 'otp_verified' });

    const safeActivations = activations.map(act => ({
      id: act._id,
      user: {
        id: act.userId?._id,
        name: act.userId?.name,
        email: act.userId?.email,
        country: act.userId?.country,
        walletAddress: act.userId?.walletAddress
      },
      plan: {
        id: act.planId?._id,
        displayName: act.planId?.displayName,
        fee: act.planId?.fee,
        color: act.planId?.color
      },
      payment: {
        coin: act.payment?.coin,
        amount: act.payment?.amount,
        confirmed: act.payment?.confirmed,
        confirmedAt: act.payment?.confirmedAt
      },
      cardDetails: {
        expiry: act.cardDetails?.expiry,
        cardholderName: act.cardDetails?.cardholderName
      },
      createdAt: act.createdAt,
      otpVerifiedAt: act.otp?.verifiedAt
    }));

    sendSuccess(res, 'Pending approvals retrieved successfully', {
      activations: safeActivations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    sendError(res, 500, 'Failed to retrieve pending approvals');
  }
};

/*
|--------------------------------------------------------------------------
| GET ACTIVATION STATISTICS (Admin only)
|--------------------------------------------------------------------------
*/
const getActivationStats = async (req, res) => {
  try {
    // Check if user is admin
    const admin = await User.findById(req.user.userId).select('role');
    if (!admin || admin.role !== 'admin') {
      return sendError(res, 403, 'Admin access required');
    }

    // Get counts by status
    const statusCounts = await CardActivation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get total revenue from confirmed payments
    const revenueData = await CardActivation.aggregate([
      {
        $match: { 'payment.confirmed': true }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$payment.amount' },
          average: { $avg: '$payment.amount' }
        }
      }
    ]);

    // Get counts by plan
    const planCounts = await CardActivation.aggregate([
      {
        $group: {
          _id: '$planId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'cardplans',
          localField: '_id',
          foreignField: '_id',
          as: 'plan'
        }
      },
      {
        $unwind: {
          path: '$plan',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          planName: '$plan.displayName',
          count: 1
        }
      }
    ]);

    // Format status counts
    const statusMap = {
      'pending': 'Pending',
      'payment_confirmed': 'Payment Confirmed',
      'otp_verified': 'OTP Verified',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'completed': 'Completed'
    };

    const formattedStatusCounts = statusCounts.map(item => ({
      status: statusMap[item._id] || item._id,
      count: item.count
    }));

    // Get today's activations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await CardActivation.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Get this week's activations
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekCount = await CardActivation.countDocuments({
      createdAt: { $gte: weekStart }
    });

    const stats = {
      total: await CardActivation.countDocuments(),
      today: todayCount,
      thisWeek: weekCount,
      byStatus: formattedStatusCounts,
      byPlan: planCounts.map(item => ({
        plan: item.planName || 'Unknown',
        count: item.count
      })),
      revenue: {
        total: revenueData[0]?.total || 0,
        average: revenueData[0]?.average || 0
      }
    };

    sendSuccess(res, 'Activation statistics retrieved successfully', stats);
  } catch (error) {
    console.error('Get activation stats error:', error);
    sendError(res, 500, 'Failed to retrieve activation statistics');
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
  completeActivation,


  getAllActivations,
  getPaymentConfirmations,
  getPendingApprovals,
  getActivationStats
};