// utils/email.js - Email utilities with Resend
const { Resend } = require('resend');
const cache = require('../db/cache');

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;



const sendOTPEmail = async (user, token) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP for 10 minutes
  const key = `otp:${user.email.toLowerCase().trim()}`;
  cache.set(key, otp.toString(), 600);

  const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/verify-otp?email=${encodeURIComponent(user.email)}&otp=${otp}`;

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'noreply@cardsecure.com',
    to: user.email,
    subject: 'Verify your CardSecure account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="background:#f5f7fb;font-family:Arial,sans-serif;padding:20px;margin:0;">
        <div style="max-width:500px;margin:auto;background:white;border-radius:14px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          
          <div style="text-align:center;margin-bottom:25px;">
            <h1 style="color:#2563eb;margin:0;font-size:28px;">CardSecure</h1>
            <p style="color:#6b7280;margin:5px 0 0;font-size:14px;">Card Services</p>
          </div>

          <h2 style="color:#1f2937;margin-top:0;">
            Hello ${user.name || 'there'},
          </h2>

          <p style="color:#4b5563;line-height:1.6;">
            Welcome to <strong>CardSecure</strong>.
          </p>

          <p style="color:#4b5563;line-height:1.6;">
            Use the verification code below to activate your account:
          </p>

          <div style="background:#eff6ff;color:#2563eb;font-size:36px;font-weight:bold;padding:20px;text-align:center;border-radius:12px;letter-spacing:10px;margin:25px 0;border:2px dashed #bfdbfe;">
            ${otp}
          </div>

          <p style="color:#6b7280;font-size:14px;">
            This code expires in <strong>10 minutes</strong>.
          </p>

          <div style="text-align:center;margin:30px 0;">
            <a href="${verificationLink}" style="background:#2563eb;color:white;padding:14px 35px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:bold;font-size:15px;">
              Verify Account
            </a>
          </div>

          <p style="color:#6b7280;font-size:13px;line-height:1.6;">
            If you didn't request this email, simply ignore it.
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">

          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
            © ${new Date().getFullYear()} CardSecure. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
  });

  return otp;
};

const sendWelcomeEmail = async (user) => {
  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'noreply@cardsecure.com',
    to: user.email,
    subject: '🎉 Welcome to CardSecure!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="background:#f5f7fb;font-family:Arial,sans-serif;padding:20px;margin:0;">
        <div style="max-width:500px;margin:auto;background:white;border-radius:14px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          
          <div style="text-align:center;margin-bottom:25px;">
            <h1 style="color:#2563eb;margin:0;font-size:28px;">CardSecure</h1>
            <p style="color:#6b7280;margin:5px 0 0;font-size:14px;">Card Services</p>
          </div>

          <h2 style="color:#1f2937;margin-top:0;">
            Welcome, ${user.name}! 🎉
          </h2>

          <p style="color:#4b5563;line-height:1.6;">
            We're excited to have you join <strong>CardSecure</strong>.
          </p>

          <p style="color:#4b5563;line-height:1.6;">
            Your account has been created successfully.
          </p>

          <h3 style="color:#1f2937;">Here's what you can do next:</h3>

          <ul style="color:#4b5563;line-height:1.8;padding-left:20px;">
            <li>✅ Complete your profile</li>
            <li>✅ Activate your virtual card</li>
            <li>✅ Deposit funds securely</li>
            <li>✅ Enable Two-Factor Authentication</li>
          </ul>

          <div style="text-align:center;margin:30px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/activate" style="background:#2563eb;color:white;padding:14px 35px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:bold;font-size:15px;">
              Activate Your Card
            </a>
          </div>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">

          <p style="color:#6b7280;font-size:13px;line-height:1.6;">
            Need help? Contact our support team anytime.
          </p>

          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
            © ${new Date().getFullYear()} CardSecure. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
  });
};

const sendPasswordResetEmail = async (user, token) => {
  const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'noreply@cardsecure.com',
    to: user.email,
    subject: 'Reset Your Password - CardSecure',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="background:#f5f7fb;font-family:Arial,sans-serif;padding:20px;margin:0;">
        <div style="max-width:500px;margin:auto;background:white;border-radius:14px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          
          <div style="text-align:center;margin-bottom:25px;">
            <h1 style="color:#2563eb;margin:0;font-size:28px;">CardSecure</h1>
            <p style="color:#6b7280;margin:5px 0 0;font-size:14px;">Card Services</p>
          </div>

          <h2 style="color:#1f2937;margin-top:0;">
            Reset Your Password
          </h2>

          <p style="color:#4b5563;line-height:1.6;">
            Hello ${user.name || 'there'},
          </p>

          <p style="color:#4b5563;line-height:1.6;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>

          <div style="text-align:center;margin:30px 0;">
            <a href="${resetLink}" style="background:#2563eb;color:white;padding:14px 35px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:bold;font-size:15px;">
              Reset Password
            </a>
          </div>

          <p style="color:#6b7280;font-size:14px;">
            This link expires in <strong>1 hour</strong>.
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">

          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
            If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      </body>
      </html>
    `,
  });
};

const sendCardActivationOTP = async (user, activationId, otp) => {
  const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/activate/verify?activationId=${activationId}`;

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'noreply@cardsecure.com',
    to: user.email,
    subject: '🔐 Card Activation OTP - CardSecure',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="background:#f5f7fb;font-family:Arial,sans-serif;padding:20px;margin:0;">
        <div style="max-width:500px;margin:auto;background:white;border-radius:14px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          
          <div style="text-align:center;margin-bottom:25px;">
            <h1 style="color:#2563eb;margin:0;font-size:28px;">CardSecure</h1>
            <p style="color:#6b7280;margin:5px 0 0;font-size:14px;">Card Services</p>
          </div>

          <h2 style="color:#1f2937;margin-top:0;">
            Hello ${user.name || 'there'},
          </h2>

          <p style="color:#4b5563;line-height:1.6;">
            You're one step away from activating your card!
          </p>

          <p style="color:#4b5563;line-height:1.6;">
            Use the verification code below to complete your card activation:
          </p>

          <div style="background:#eff6ff;color:#2563eb;font-size:36px;font-weight:bold;padding:20px;text-align:center;border-radius:12px;letter-spacing:10px;margin:25px 0;border:2px dashed #bfdbfe;">
            ${otp}
          </div>

          <p style="color:#6b7280;font-size:14px;">
            This code expires in <strong>10 minutes</strong>.
          </p>

          <div style="text-align:center;margin:30px 0;">
            <a href="${verificationLink}" style="background:#2563eb;color:white;padding:14px 35px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:bold;font-size:15px;">
              Verify & Activate
            </a>
          </div>

          <p style="color:#6b7280;font-size:13px;line-height:1.6;">
            If you didn't request this, simply ignore it.
          </p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">

          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
            © ${new Date().getFullYear()} CardSecure. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
  });
};

const sendActivationApprovedEmail = async (user, planName) => {
  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'noreply@cardsecure.com',
    to: user.email,
    subject: '✅ Your Card Has Been Activated!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="background:#f5f7fb;font-family:Arial,sans-serif;padding:20px;margin:0;">
        <div style="max-width:500px;margin:auto;background:white;border-radius:14px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          
          <div style="text-align:center;margin-bottom:25px;">
            <h1 style="color:#2563eb;margin:0;font-size:28px;">CardSecure</h1>
            <p style="color:#6b7280;margin:5px 0 0;font-size:14px;">Card Services</p>
          </div>

          <h2 style="color:#1f2937;margin-top:0;">
            Congratulations, ${user.name}! 🎉
          </h2>

          <p style="color:#4b5563;line-height:1.6;">
            Your <strong>${planName}</strong> has been successfully activated!
          </p>

          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;margin:25px 0;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <span style="font-size:24px;">✅</span>
              <span style="font-weight:bold;color:#166534;">Card Activated</span>
            </div>
            <p style="color:#166534;margin:0;font-size:14px;">
              You can now start using your card for purchases and withdrawals.
            </p>
          </div>

          <div style="text-align:center;margin:30px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" style="background:#2563eb;color:white;padding:14px 35px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:bold;font-size:15px;">
              Go to Dashboard
            </a>
          </div>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">

          <p style="color:#6b7280;font-size:13px;line-height:1.6;">
            Need help? Contact our support team anytime.
          </p>

          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">
            © ${new Date().getFullYear()} CardSecure. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
  });
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendCardActivationOTP,
  sendActivationApprovedEmail,
};