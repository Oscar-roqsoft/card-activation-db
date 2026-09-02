// routes/coinWallets.js
const express = require('express');
const router = express.Router();

const {
  getCoinWallets,
  getWalletByCoin,
  createCoinWallet,
  updateCoinWallet,
  deleteCoinWallet
} = require('../handlers/coinWallets');

const { verifyToken, adminAuth } = require('../../../middlewares/authentication');

// Public routes (read-only)
router.route('/').get(getCoinWallets);
router.route('/:coin').get(getWalletByCoin);

// Admin routes
router.route('/').post(verifyToken, adminAuth, createCoinWallet);
router.route('/:walletId').put(verifyToken, adminAuth, updateCoinWallet);
router.route('/:walletId').delete(verifyToken, adminAuth, deleteCoinWallet);

module.exports = router;