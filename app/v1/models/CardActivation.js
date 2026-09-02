// models/CardActivation.js
const mongoose = require('mongoose');

const CardActivationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CardPlan',
    required: true
  },
  cardDetails: {
    number: {
      type: String,
      required: true,
      select: false // Hide sensitive data
    },
    expiry: {
      type: String,
      required: true
    },
    cvv: {
      type: String,
      required: true,
      select: false // Hide sensitive data
    },
    cardholderName: {
      type: String,
      required: true
    }
  },
  payment: {
    coin: {
      type: String,
      enum: ['USDT', 'BTC', 'ETH', 'XRP', 'SOL', 'ADA'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    walletAddress: {
      type: String,
    },
    
    transactionHash: {
      type: String,
      default: null
    },
    confirmed: {
      type: Boolean,
      default: false
    },
    confirmedAt: {
      type: Date,
      default: null
    }
  },
  otp: {
    code: {
      type: String,
      select: false
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    },
    attempts: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['pending', 'payment_confirmed', 'otp_verified', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster queries
CardActivationSchema.index({ userId: 1, status: 1 });
CardActivationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CardActivation', CardActivationSchema);