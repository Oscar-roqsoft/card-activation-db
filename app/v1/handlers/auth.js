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

// In-memory OTP cache (use Redis in production)
const otpCache = {};
const {
    sendConflictResponse,
    sendBadRequestResponse,
    sendUnauthenticatedErrorResponse,
    sendSuccessResponseData
  } = require('../responses');
  

/*
|--------------------------------------------------------------------------
| REGISTER
|--------------------------------------------------------------------------
*/
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return sendBadRequestResponse(
        res,
        'Please provide name, email, and password'
      );
    }

    // Validate email format
    if (!validateEmail(email)) {
      return sendBadRequestResponse(res, 'Please provide a valid email address');
    }

    // Validate password strength
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return sendBadRequestResponse(res, passwordErrors[0]);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return sendConflictResponse(res, 'Email already exists');
    }

    // Generate wallet address
    // const walletAddress = '0x' + crypto.randomBytes(20).toString('hex');

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: '',
      country: '',
      balances: {
        BTC: 0,
        ETH: 0,
        USDT: 0
      },
      isVerified: false
    });

   

    // Send OTP email
    const safeUser = sanitizeUser(user);
    
    // Generate JWT for verification
    const token = user.createJWT();
    
    await sendOTPEmail(safeUser, token);

    sendSuccessResponseData(
      res,
      'User registered successfully. OTP sent to email.',
      {
        token,
        user: safeUser
      }
    );
  } catch (error) {
    console.error('Register error:', error);
    sendUnauthenticatedErrorResponse(res, error.message);
  }
};

/*
|--------------------------------------------------------------------------
| VERIFY OTP
|--------------------------------------------------------------------------
*/
const verifyOTP = async (req, res) => {

  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendBadRequestResponse(res, 'Email and OTP required');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cacheKey = `otp:${normalizedEmail.toLowerCase().trim()}`;
    // const normalizedEmail = email.toLowerCase().trim();

    // const key = `otp:${normalizedEmail.toLowerCase().trim()}`;
    const storedOTP = cache.get(cacheKey);

    console.log(storedOTP,otp,email)

    if (!storedOTP) {
      return sendBadRequestResponse(res, 'OTP expired or invalid');
    }

    
    if (storedOTP !== String(otp)) {
      return sendBadRequestResponse(res, 'Invalid OTP');
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return sendBadRequestResponse(res, 'User not found');
    }

    if (user.isVerified) {
      return sendBadRequestResponse(res, 'Email already verified');
    }

    // Mark user as verified
    user.isVerified = true;
    await user.save();

    // Remove OTP from cache
    delete otpCache[cacheKey];

    // Send welcome email
    const safeUser = sanitizeUser(user);
    await sendWelcomeEmail(safeUser);

    const token = user.createJWT();

    sendSuccessResponseData(res, 'Email verified successfully', {
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    sendUnauthenticatedErrorResponse(res, error.message);
  }
};

/*
|--------------------------------------------------------------------------
| RESEND OTP
|--------------------------------------------------------------------------
*/
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendBadRequestResponse(res, 'Email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return sendBadRequestResponse(res, 'User not found');
    }

    if (user.isVerified) {
      return sendBadRequestResponse(res, 'Email already verified');
    }

     // Generate JWT for verification
     const token = user.createJWT();

    // Send OTP email
    const safeUser = sanitizeUser(user);
    await sendOTPEmail(safeUser, token);

    sendSuccessResponseData(res, 'OTP resent successfully', null);
  } catch (error) {
    console.error('Resend OTP error:', error);
    sendUnauthenticatedErrorResponse(res, error.message);
  }
};

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendBadRequestResponse(res, 'Email and password required');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return sendBadRequestResponse(res, 'Invalid credentials');
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return sendBadRequestResponse(res, 'Invalid credentials');
    }

    // Check if account is verified
    if (!user.isVerified) {
      const token = user.createJWT();
      const safeUser = sanitizeUser(user);
      await sendOTPEmail(safeUser, null);
      return sendSuccessResponseData(
        res,
        'Account not verified. OTP sent to your email.',
        {
          token,
          user: safeUser,
          requiresVerification: true
        }
      );
    }

    const token = user.createJWT();
    const safeUser = sanitizeUser(user);

    sendSuccessResponseData(res, 'Login successful', {
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Login error:', error);
    sendUnauthenticatedErrorResponse(res, error.message);
  }
};

/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD
|--------------------------------------------------------------------------
*/
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendBadRequestResponse(res, 'Email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return sendNotFoundResponse(res, 'User not found');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send reset email
    const safeUser = sanitizeUser(user);
    await sendPasswordResetEmail(safeUser, resetToken);

    sendSuccessResponseData(res, 'Password reset link sent to your email', null);
  } catch (error) {
    console.error('Forgot password error:', error);
    sendUnauthenticatedErrorResponse(res, error.message);
  }
};

/*
|--------------------------------------------------------------------------
| RESET PASSWORD (with token)
|--------------------------------------------------------------------------
*/
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return sendBadRequestResponse(res, 'Token and new password required');
    }

    // Validate password strength
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return sendBadRequestResponse(res, passwordErrors[0]);
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return sendBadRequestResponse(res, 'Invalid or expired reset token');
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendSuccessResponseData(res, 'Password reset successfully', null);
  } catch (error) {
    console.error('Reset password error:', error);
    sendUnauthenticatedErrorResponse(res, error.message);
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE PASSWORD (authenticated user)
|--------------------------------------------------------------------------
*/
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendBadRequestResponse(res, 'Current password and new password required');
    }

    // Validate new password strength
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return sendBadRequestResponse(res, passwordErrors[0]);
    }

    const user = await User.findById(req.user.userId).select('+password');

    if (!user) {
      return sendNotFoundResponse(res, 'User not found');
    }

    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      return sendBadRequestResponse(res, 'Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    sendSuccessResponseData(res, 'Password updated successfully', null);
  } catch (error) {
    console.error('Update password error:', error);
    sendUnauthenticatedErrorResponse(res, error.message);
  }
};

/*
|--------------------------------------------------------------------------
| GET CURRENT USER
|--------------------------------------------------------------------------
*/
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return sendNotFoundResponse(res, 'User not found');
    }

    const safeUser = sanitizeUser(user);
    sendSuccessResponseData(res, 'User retrieved successfully', { user: safeUser });
  } catch (error) {
    console.error('Get current user error:', error);
    sendUnauthenticatedErrorResponse(res, error.message);
  }
};

module.exports = {
  register,
  verifyOTP,
  resendOTP,
  login,
  forgotPassword,
  resetPassword,
  updatePassword,
  getCurrentUser
};