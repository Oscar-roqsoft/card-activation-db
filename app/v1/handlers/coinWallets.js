// handlers/coinWallets.js
const CoinWallet = require('../models/CoinWallet');

// Response helpers
const sendSuccess = (res, message, data) => {
  res.status(200).json({ success: true, message, data: data || null });
};

const sendError = (res, status, message) => {
  res.status(status).json({ success: false, error: message });
};

/*
|--------------------------------------------------------------------------
| GET ALL COIN WALLETS
|--------------------------------------------------------------------------
*/
const getCoinWallets = async (req, res) => {
  try {
    const wallets = await CoinWallet.find({ isActive: true })
      .select('-__v')
      .lean();

    sendSuccess(res, 'Coin wallets retrieved successfully', { wallets });
  } catch (error) {
    console.error('Get coin wallets error:', error);
    sendError(res, 500, 'Failed to retrieve coin wallets');
  }
};

/*
|--------------------------------------------------------------------------
| GET WALLET BY COIN
|--------------------------------------------------------------------------
*/
const getWalletByCoin = async (req, res) => {
  try {
    const { coin } = req.params;
    const wallet = await CoinWallet.findOne({ coin: coin.toUpperCase(), isActive: true })
      .select('-__v')
      .lean();

    if (!wallet) {
      return sendError(res, 404, `Wallet for ${coin} not found`);
    }

    sendSuccess(res, 'Wallet retrieved successfully', { wallet });
  } catch (error) {
    console.error('Get wallet by coin error:', error);
    sendError(res, 500, 'Failed to retrieve wallet');
  }
};

/*
|--------------------------------------------------------------------------
| CREATE COIN WALLET (Admin only)
|--------------------------------------------------------------------------
*/
const createCoinWallet = async (req, res) => {
  try {
    const { coin, network, address, label } = req.body;

    if (!coin || !network || !address) {
      return sendError(res, 400, 'Coin, network, and address are required');
    }

    const existing = await CoinWallet.findOne({ coin, address });
    if (existing) {
      return sendError(res, 409, 'Wallet already exists');
    }

    const wallet = await CoinWallet.create({
      coin: coin.toUpperCase(),
      network,
      address,
      label: label || null
    });

    sendSuccess(res, 'Coin wallet created successfully', { wallet });
  } catch (error) {
    console.error('Create coin wallet error:', error);
    sendError(res, 500, 'Failed to create coin wallet');
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE COIN WALLET (Admin only)
|--------------------------------------------------------------------------
*/
const updateCoinWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const updates = req.body;

    const wallet = await CoinWallet.findById(walletId);
    if (!wallet) {
      return sendError(res, 404, 'Wallet not found');
    }

    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== '__v') {
        wallet[key] = updates[key];
      }
    });

    await wallet.save();

    sendSuccess(res, 'Coin wallet updated successfully', { wallet });
  } catch (error) {
    console.error('Update coin wallet error:', error);
    sendError(res, 500, 'Failed to update coin wallet');
  }
};

/*
|--------------------------------------------------------------------------
| DELETE COIN WALLET (Admin only)
|--------------------------------------------------------------------------
*/
const deleteCoinWallet = async (req, res) => {
  try {
    const { walletId } = req.params;

    const wallet = await CoinWallet.findById(walletId);
    if (!wallet) {
      return sendError(res, 404, 'Wallet not found');
    }

    // Soft delete
    wallet.isActive = false;
    await wallet.save();

    sendSuccess(res, 'Coin wallet deleted successfully', null);
  } catch (error) {
    console.error('Delete coin wallet error:', error);
    sendError(res, 500, 'Failed to delete coin wallet');
  }
};

module.exports = {
  getCoinWallets,
  getWalletByCoin,
  createCoinWallet,
  updateCoinWallet,
  deleteCoinWallet
};