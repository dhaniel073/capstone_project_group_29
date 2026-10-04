const express = require("express");
const { register, login, getMe, forgotPassword, resetPassword, validateResetToken } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { registerSchema, loginSchema, forgotpasswordSchema, resetPasswordSchema } = require("../validations/authValidation");

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.get("/me", protect, getMe);
router.post("/forgot-password", validate(forgotpasswordSchema), forgotPassword);
router.post("/reset-password/validate", validateResetToken);
router.post("/reset-password/:token", validate(resetPasswordSchema), resetPassword);

module.exports = router;
