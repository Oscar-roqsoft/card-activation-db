// models/CoinWallet.js
const mongoose = require('mongoose');

const CoinWalletSchema = new mongoose.Schema({
  coin: {
    type: String,
    required: true,
    enum: ['USDT', 'BTC', 'ETH', 'XRP', 'SOL', 'ADA']
  },
  network: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true,
    unique: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  label: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for quick lookup
CoinWalletSchema.index({ coin: 1, isActive: 1 });

module.exports = mongoose.model('CoinWallet', CoinWalletSchema);