// utils/authUtils.js
const crypto = require('crypto');

// Generate random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate wallet address
const generateWalletAddress = (coin) => {
  return `0x${crypto.randomBytes(20).toString('hex')}`;
};


// Validate password strength
const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return errors;
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

// Sanitize user data for response
const sanitizeUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    country: user.country,
    avatar: user.avatar || '',
    walletAddress: user.walletAddress,
    balances: user.balances,
    role: user.role,
    isVerified: user.isVerified,
    isPinSet: user.isPinSet,
    pin: user.pin || null,
    twoFactorVerification: user.twoFactorVerification || false,
    userIdentity: user.userIdentity || ''
  };
};

module.exports = {
  generateOTP,
  generateWalletAddress,
  validatePassword,
  validateEmail,
  sanitizeUser
};