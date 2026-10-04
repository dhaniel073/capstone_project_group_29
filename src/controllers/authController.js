const User = require("../models/User");
const AppError = require("../utils/AppError");
const ApiResponse = require("../utils/apiResponse");
const catchAsync = require("../utils/catchAsync");
const generateToken = require("../utils/generateToken");
const crypto = require("crypto");
const PasswordResetToken = require("../models/PasswordResetToken");
const sendEmail = require("../utils/sendEmail");
const forgotPasswordEmailTemplate = require("../EmailTemplates/forgotPasswordEmailTemplate");
const emailTemplate = require("../EmailTemplates/emailTemplate");

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) return next(new AppError("An account with this email already exists", 409));

  const user = await User.create({ name, email, password, role: role || "customer" });
  const token = generateToken(user._id);

  const welcomeEmail = emailTemplate({
    name: newUser.name,
    subject: "Welcome to Capstone 29 Supermarket",
    title: "Welcome to Capstone 29 Supermarket",
    message:
      "Your account has been created successfully. You can now shop for groceries and have them delivered to your address.",
    buttonText: "Start Shopping",
    buttonUrl: `${process.env.FRONTEND_URL}/`,
    notice: "Keep your login credentials secure and do not share your password with anyone.",
  });

  try {
    await sendEmail({
      to: newUser.email,
      subject: welcomeEmail.subject,
      text: welcomeEmail.text,
      html: welcomeEmail.html,
    });
  } catch (error) {
    console.error("Welcome email could not be sent:", error.message);
  }
  return ApiResponse.success(res, {
    statusCode: 201,
    message: "Account created successfully",
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role }, token },
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError("Invalid email or password", 401));
  }
  if (!user.isActive) return next(new AppError("This account has been deactivated", 403));

  const token = generateToken(user._id);

  return ApiResponse.success(res, {
    message: "Login successful",
    data: { user: { id: user._id, name: user.name, email: user.email, role: user.role }, token },
  });
});

exports.getMe = catchAsync(async (req, res) => {
  const user = req.user;
  return ApiResponse.success(res, {
    message: "Profile fetched successfully",
    data: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const email = req.body.email?.trim().toLowerCase();

  if (!email) {
    return next(new AppError("Email address is required", 400));
  }

  const genericMessage =
    "If an account exists for this email, a password reset link has been sent.";

  const user = await User.findOne({ email });

  if (!user) {
    return ApiResponse.success(res, {
      statusCode: 200,
      message: genericMessage,
    });
  }

  await PasswordResetToken.deleteMany({
    user: user._id,
  });

  const rawToken = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

  await PasswordResetToken.create({
    user: user._id,
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${
    process.env.FRONTEND_URL
  }/reset-password?token=${encodeURIComponent(rawToken)}`;

  const emailTemplate = forgotPasswordEmailTemplate({
    name: user.name,
    resetUrl,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    console.log(`Password reset email sent to: ${user.email}`);
  } catch (error) {
    
    await PasswordResetToken.deleteOne({
      tokenHash,
    });

    console.error("PASSWORD RESET EMAIL FAILED");
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Response code:", error.responseCode);
    console.error("Response:", error.response);

    return next(
      new AppError(
        "Unable to send password reset email. Please try again later.",
        500
      )
    );
  }

  return ApiResponse.success(res, {
    statusCode: 200,
    message: genericMessage,
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!token) {
    return next(new AppError("Reset token is required", 400));
  }

  if (!password || !confirmPassword) {
    return next(
      new AppError("Password and confirm password are required", 400)
    );
  }

  if (password.length < 6) {
    return next(
      new AppError("Password must be at least 6 characters long", 400)
    );
  }

  if (password !== confirmPassword) {
    return next(new AppError("Passwords do not match", 400));
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const resetToken = await PasswordResetToken.findOne({
    tokenHash,
    usedAt: null,
    expiresAt: {
      $gt: new Date(),
    },
  });

  if (!resetToken) {
    return next(
      new AppError(
        "This password reset link is invalid or has expired. Please request a new one.",
        400
      )
    );
  }

  const user = await User.findById(resetToken.user);

  if (!user) {
    await PasswordResetToken.deleteOne({
      _id: resetToken._id,
    });

    return next(
      new AppError(
        "This password reset link is invalid or has expired. Please request a new one.",
        400
      )
    );
  }

  user.password = password;

  await user.save();

  await PasswordResetToken.deleteMany({
    user: user._id,
  });

  const passwordResetSuccessEmail = emailTemplate({
    name: user.name,
    subject: "Your  Capstone 29 Supermarket password was changed",
    title: "Password changed successfully",
    message:
      "Your password has been reset successfully. You can now sign in with your new password.",
    buttonText: "Log In",
    buttonUrl: `${process.env.FRONTEND_URL}/login`,
    notice:
      "If you did not make this password change, contact  Capstone 29 market support immediately.",
  });

  try {
    await sendEmail({
      to: user.email,
      subject: passwordResetSuccessEmail.subject,
      text: passwordResetSuccessEmail.text,
      html: passwordResetSuccessEmail.html,
    });
  } catch (error) {
    /*
      Password has already changed. Do not fail the reset endpoint merely
      because the notification email failed. Log it for debugging instead.
    */
    console.error(
      "Password reset success email could not be sent:",
      error.message
    );
  }

  return ApiResponse.success(res, {
    statusCode: 200,
    message:
      "Password reset successful. You can now log in with your new password.",
  });
});

exports.validateResetToken = catchAsync(async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return next(new AppError("Reset token is required", 400));
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const resetToken = await PasswordResetToken.findOne({
    tokenHash,
    usedAt: null,
    expiresAt: {
      $gt: new Date(),
    },
  });

  if (!resetToken) {
    return next(
      new AppError(
        "This password reset link is invalid or has expired. Please request a new one.",
        400
      )
    );
  }

  return ApiResponse.success(res, {
    statusCode: 200,
    message: "Password reset link is valid",
    data: {
      valid: true,
      expiresAt: resetToken.expiresAt,
    },
  });
});
