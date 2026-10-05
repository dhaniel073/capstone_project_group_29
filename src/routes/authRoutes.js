const express = require("express");

const {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  validateResetToken,
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
  authLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimiter");

const router = express.Router();

router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  register
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  login
);

router.get("/me", protect, getMe);

router.post(
  "/forgot-password",
  passwordResetLimiter,
  validate(forgotpasswordSchema),
  forgotPassword
);

router.post(
  "/reset-password/validate",
  passwordResetLimiter,
  validateResetToken
);

router.post(
  "/reset-password/:token",
  passwordResetLimiter,
  validate(resetPasswordSchema),
  resetPassword
);

module.exports = router;