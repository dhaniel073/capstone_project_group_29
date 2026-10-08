const express = require("express");

const {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  validateResetToken,
  forgotAdminPassword,
  validateAdminResetToken,
  sendAdminResetOtp,
  verifyAdminResetOtp,
  resetAdminPassword,
} = require("../controllers/authController");

const { protect } = require("../middleware/auth");

const validate = require("../middleware/validate");

const {
  registerSchema,
  loginSchema,
  forgotpasswordSchema,
  resetPasswordSchema,
} = require("../validations/authValidation");

const {
  adminForgotPasswordSchema,
  adminValidateResetTokenSchema,
  adminSendResetOtpSchema,
  adminVerifyResetOtpSchema,
  adminResetPasswordSchema,
} = require("../validations/adminPasswordResetSchemas");

const {
  authLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimiter");

const router = express.Router();

// Registration
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  register
);

// Login
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  login
);

// Current authenticated user
router.get("/me", protect, getMe);

// Customer: request password reset link
router.post(
  "/forgot-password",
  passwordResetLimiter,
  validate(forgotpasswordSchema),
  forgotPassword
);

// Customer: validate password reset link
router.post(
  "/reset-password/validate",
  passwordResetLimiter,
  validateResetToken
);

// Customer: reset password
router.post(
  "/reset-password/:token",
  passwordResetLimiter,
  validate(resetPasswordSchema),
  resetPassword
);

// Admin: request password reset link
router.post(
  "/admin/forgot-password",
  passwordResetLimiter,
  validate(adminForgotPasswordSchema),
  forgotAdminPassword
);

// Admin: validate password reset link
router.post(
  "/admin/reset-password/validate",
  passwordResetLimiter,
  validate(adminValidateResetTokenSchema),
  validateAdminResetToken
);

router.post(
  "/admin/reset-password/send-otp",
  passwordResetLimiter,
  validate(adminSendResetOtpSchema),
  sendAdminResetOtp
);

router.post(
  "/admin/reset-password/verify-otp",
  passwordResetLimiter,
  validate(adminVerifyResetOtpSchema),
  verifyAdminResetOtp
);

router.post(
  "/admin/reset-password",
  passwordResetLimiter,
  validate(adminResetPasswordSchema),
  resetAdminPassword
);
module.exports = router;