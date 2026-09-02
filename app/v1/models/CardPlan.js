// models/CardPlan.js
const mongoose = require('mongoose');

const CardPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide plan name'],
    enum: ['gold', 'black'],
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  fee: {
    type: Number,
    required: [true, 'Please provide activation fee'],
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  benefits: [{
    type: String,
    required: true
  }],
  features: {
    cashback: {
      type: String,
    },
    loungeAccess: {
      type: String,
    },
    insurance: {
      type: String,
    },
    support: {
      type: String,
    }
  },
  color: {
    primary: { type: String, default: '#fbbf24' },
    secondary: { type: String, default: '#d97706' },
    gradient: { type: String, default: 'from-yellow-400 to-yellow-600' }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CardPlan', CardPlanSchema);