// handlers/auth.js
const User = require('../models/user');
const crypto = require('crypto');
const cache = require('../../../db/cache');
const {
  generateOTP,
  generateWalletAddress,
  validatePassword,
  validateEmail,
  sanitizeUser
} = require('../../../utils/authUtils');


const {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail
} = require('../../../utils/emailUtils');


const getAllUsers = async (req, res) => {
    try {
      // Check the logged-in user
      const admin = await User.findById(req.user.userId).select('role');
  
      if (!admin) {
        return sendUnauthenticatedErrorResponse(
          res,
          'User not found'
        );
      }
  
      // Only admins can access this endpoint
      if (admin.role !== 'admin') {
        return sendUnauthenticatedErrorResponse(
          res,
          'Admin access required'
        );
      }
  
      // Get all users
      const users = await User.find()
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .sort({ createdAt: -1 });
  
      return sendSuccessResponseData(
        res,
        'Users retrieved successfully',
        {
          users,
          total: users.length
        }
      );
  
    } catch (error) {
      console.error('Get all users error:', error);
  
      return sendUnauthenticatedErrorResponse(
        res,
        error.message
      );
    }
  };


module.exports = {
    getAllUsers
};