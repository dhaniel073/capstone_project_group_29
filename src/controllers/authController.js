const mongoose = require("mongoose");
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
const AdminPasswordReset = require("../models/AdminPasswordReset");

const {
  LINK_TTL_MS,
  OTP_TTL_MS,
  RESET_AUTHORIZATION_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
  MAX_OTP_SENDS,
  generateRecoveryToken,
  hashRecoveryToken,
  generateOtp,
  createOtpVerifier,
  matchesOtpVerifier,
} = require("../utils/adminPasswordResetSecurity");

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return next(
      new AppError("An account with this email already exists", 409)
    );
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role || "customer",
  });

  const token = generateToken(user._id);

  try {
    const welcomeEmail = emailTemplate({
      name: user.name,
      subject: "Welcome to Capstone 29 Supermarket",
      title: "Welcome to Capstone 29 Supermarket",
      message:
        "Your account has been created successfully. You can now shop for groceries and have them delivered to your address.",
      buttonText: "Start Shopping",
      buttonUrl: `${process.env.FRONTEND_URL}/`,
      notice:
        "Keep your login credentials secure and do not share your password with anyone.",
    });

    await sendEmail({
      to: user.email,
      subject: welcomeEmail.subject,
      text: welcomeEmail.text,
      html: welcomeEmail.html,
    });
  } catch (error) {
    console.error(
      "Welcome email could not be sent:",
      error.message
    );
  }

  return ApiResponse.success(res, {
    statusCode: 201,
    message: "Account created successfully",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    },
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

  const user = await User.findOne({
    email,
    role: "customer",
    isActive: true,
  });

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

  const user = await User.findOne({
    _id: resetToken.user,
    role: "customer",
    isActive: true,
  });

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

  const user = await User.findOne({
  _id: resetToken.user,
  role: "customer",
  isActive: true,
}).select("_id");

if (!user) {
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

exports.forgotAdminPassword = catchAsync(async (req, res, next) => {
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  if (!email) {
    return next(new AppError("Email address is required", 400));
  }

  const genericMessage =
    "If an eligible admin account exists for this email, a password reset link has been sent.";

  const user = await User.findOne({
    email,
    role: "admin",
    isActive: true,
  });

  if (!user) {
    return ApiResponse.success(res, {
      statusCode: 200,
      message: genericMessage,
    });
  }

  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    return next(
      new AppError("Password recovery is temporarily unavailable", 500)
    );
  }

  let resetUrl;

  try {
    resetUrl = new URL("/admin/reset-password", frontendUrl);
  } catch (error) {
    console.error("Invalid FRONTEND_URL configuration:", error.message);

    return next(
      new AppError("Password recovery is temporarily unavailable", 500)
    );
  }

  const rawToken = generateRecoveryToken();

  const recovery = await AdminPasswordReset.create({
    user: user._id,
    linkTokenHash: hashRecoveryToken(rawToken),
    expiresAt: new Date(Date.now() + LINK_TTL_MS),
    stage: "link",
  });

  resetUrl.searchParams.set("token", rawToken);

  const template = forgotPasswordEmailTemplate({
    name: user.name,
    resetUrl: resetUrl.toString(),
  });

  try {
    await sendEmail({
      to: user.email,
      subject: "Reset your Supermarket admin password",
      text: template.text,
      html: template.html,
    });
  } catch (error) {
    await AdminPasswordReset.deleteOne({
      _id: recovery._id,
    });

    console.error("ADMIN PASSWORD RESET EMAIL FAILED");
    console.error("Message:", error.message);
    console.error("Code:", error.code);

    // Keep the public response generic so delivery failures do not
    // reveal whether an admin account exists.
    return ApiResponse.success(res, {
      statusCode: 200,
      message: genericMessage,
    });
  }

  return ApiResponse.success(res, {
    statusCode: 200,
    message: genericMessage,
  });
});

exports.validateAdminResetToken = catchAsync(
  async (req, res, next) => {
    const { token } = req.body;

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token)
    ) {
      return next(
        new AppError(
          "This password reset link is invalid or has expired. Please request a new one.",
          400
        )
      );
    }

    const recovery = await AdminPasswordReset.findOne({
      linkTokenHash: hashRecoveryToken(token),
      stage: { $in: ["link", "otp"] },
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!recovery) {
      return next(
        new AppError(
          "This password reset link is invalid or has expired. Please request a new one.",
          400
        )
      );
    }

    const user = await User.findOne({
      _id: recovery.user,
      role: "admin",
      isActive: true,
    }).select("_id");

    if (!user) {
      return next(
        new AppError(
          "This password reset link is invalid or has expired. Please request a new one.",
          400
        )
      );
    }

    return ApiResponse.success(res, {
      statusCode: 200,
      message: "Admin password reset link is valid",
      data: {
        valid: true,
        expiresAt: recovery.expiresAt,
      },
    });
  }
);

exports.sendAdminResetOtp = catchAsync(async (req, res, next) => {
  const { token } = req.body;

  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return next(
      new AppError(
        "This reset link is invalid or has expired. Please request a new one.",
        400
      )
    );
  }

  const now = new Date();

  const recovery = await AdminPasswordReset.findOne({
    linkTokenHash: hashRecoveryToken(token),
    stage: { $in: ["link", "otp"] },
    consumedAt: null,
    expiresAt: { $gt: now },
  }).select("+otpVerifier");

  if (!recovery) {
    return next(
      new AppError(
        "This reset link is invalid or has expired. Please request a new one.",
        400
      )
    );
  }

  const user = await User.findOne({
    _id: recovery.user,
    role: "admin",
    isActive: true,
  });

  if (!user) {
    return next(
      new AppError(
        "This recovery request is no longer valid.",
        400
      )
    );
  }

  if (recovery.otpAttempts >= MAX_OTP_ATTEMPTS) {
    return next(
      new AppError(
        "Too many verification attempts. Please request a new reset link.",
        429
      )
    );
  }

  // Resume a valid challenge instead of replacing its code.
  if (
    recovery.stage === "otp" &&
    recovery.otpVerifier &&
    recovery.otpExpiresAt &&
    recovery.otpExpiresAt > now
  ) {
    return ApiResponse.success(res, {
      statusCode: 200,
      message:
        "Use the verification code already sent to your admin email.",
      data: {
        challengeId: recovery._id.toString(),
        otpExpiresAt: recovery.otpExpiresAt,
      },
    });
  }

  if (recovery.otpSendCount >= MAX_OTP_SENDS) {
    return next(
      new AppError(
        "The verification code send limit has been reached. Please request a new reset link.",
        429
      )
    );
  }

  if (
    recovery.lastOtpSentAt &&
    now.getTime() - recovery.lastOtpSentAt.getTime() <
      OTP_RESEND_COOLDOWN_MS
  ) {
    return next(
      new AppError(
        "Please wait before requesting another verification code.",
        429
      )
    );
  }

  const otp = generateOtp();
  const otpVerifier = createOtpVerifier(recovery._id, otp);

  const otpExpiresAt = new Date(
    Math.min(
      now.getTime() + OTP_TTL_MS,
      recovery.expiresAt.getTime()
    )
  );

  const updatedRecovery = await AdminPasswordReset.findOneAndUpdate(
    {
      _id: recovery._id,
      stage: { $in: ["link", "otp"] },
      consumedAt: null,
      expiresAt: { $gt: now },
      otpAttempts: { $lt: MAX_OTP_ATTEMPTS },
      otpSendCount: recovery.otpSendCount,
      lastOtpSentAt: recovery.lastOtpSentAt || null,
    },
    {
      $set: {
        stage: "otp",
        otpVerifier,
        otpExpiresAt,
        lastOtpSentAt: now,
      },
      $inc: {
        otpSendCount: 1,
      },
    },
    { new: true }
  );

  if (!updatedRecovery) {
    return next(
      new AppError(
        "The recovery request changed. Please wait and try again.",
        409
      )
    );
  }

  try {
    await sendEmail({
      to: user.email,
      subject: "Your Supermarket admin verification code",

      text: [
        "SUPERMARKET - ADMIN PASSWORD RESET",
        "",
        `Your verification code is: ${otp}`,
        "",
        "This code expires in 5 minutes or when your reset link expires, whichever comes first.",
        "",
        "Return to the password reset page you already opened and enter this code.",
        "",
        "Do not share this code. If you did not request this reset, ignore this email.",
      ].join("\n"),

      html: `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Admin Verification Code</title>
          </head>
          <body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center" style="padding:32px 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;">
                    <tr>
                      <td align="center" style="background:#00875a;padding:24px;color:#ffffff;font-size:24px;font-weight:700;">
                        SUPERMARKET
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:32px;color:#14532d;">
                        <h1 style="margin:0 0 16px;font-size:24px;">
                          Verify your admin password reset
                        </h1>
                        <p style="color:#374151;line-height:1.6;">
                          Enter this code on the password reset page you already opened:
                        </p>
                        <p style="margin:24px 0;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;text-align:center;color:#00875a;font-size:32px;font-weight:700;letter-spacing:6px;">
                          ${otp}
                        </p>
                        <p style="color:#374151;line-height:1.6;">
                          This code expires in 5 minutes or when your reset link expires, whichever comes first.
                        </p>
                        <p style="color:#4b5563;font-size:13px;line-height:1.6;">
                          Do not share this code. If you did not request a password reset, ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });
  } catch (error) {
    await AdminPasswordReset.updateOne(
      {
        _id: updatedRecovery._id,
        stage: "otp",
        otpVerifier,
      },
      {
        $set: {
          otpVerifier: null,
          otpExpiresAt: null,
        },
      }
    );

    console.error("ADMIN RESET OTP EMAIL FAILED:", {
      message: error.message,
      code: error.code,
    });

    return next(
      new AppError(
        "Unable to send the verification code. Please try again later.",
        503
      )
    );
  }

  return ApiResponse.success(res, {
    statusCode: 200,
    message: "A verification code has been sent to your admin email.",
    data: {
      challengeId: updatedRecovery._id.toString(),
      otpExpiresAt,
    },
  });
});

exports.verifyAdminResetOtp = catchAsync(async (req, res, next) => {
  const { challengeId, otp } = req.body;

  if (
    typeof challengeId !== "string" ||
    !/^[a-fA-F0-9]{24}$/.test(challengeId)
  ) {
    return next(
      new AppError(
        "Invalid recovery request. Please request a new reset link.",
        400
      )
    );
  }

  if (
    typeof otp !== "string" ||
    !/^\d{6}$/.test(otp.trim())
  ) {
    return next(
      new AppError("Enter a valid 6-digit verification code.", 400)
    );
  }

  const now = new Date();

  // Reserve one verification attempt before checking the code.
  const recovery = await AdminPasswordReset.findOneAndUpdate(
    {
      _id: challengeId,
      stage: "otp",
      consumedAt: null,
      expiresAt: { $gt: now },
      otpExpiresAt: { $gt: now },
      otpVerifier: { $ne: null },
      otpAttempts: { $lt: MAX_OTP_ATTEMPTS },
    },
    {
      $inc: {
        otpAttempts: 1,
      },
    },
    {
      new: true,
    }
  ).select("+otpVerifier");

  if (!recovery) {
    return next(
      new AppError(
        "The verification code has expired, the attempt limit has been reached, or the request is no longer valid. Please request a new reset link.",
        400
      )
    );
  }

  const user = await User.findOne({
    _id: recovery.user,
    role: "admin",
    isActive: true,
  }).select("_id");

  if (!user) {
    return next(
      new AppError(
        "This recovery request is no longer valid.",
        400
      )
    );
  }

  const codeMatches = matchesOtpVerifier(
    recovery._id,
    otp.trim(),
    recovery.otpVerifier
  );

  if (!codeMatches) {
    return next(
      new AppError(
        "Incorrect verification code. Please check your email.",
        400
      )
    );
  }

  const rawResetAuthorization = generateRecoveryToken();
  const verifiedAt = new Date();

  const resetAuthorizationExpiresAt = new Date(
    Math.min(
      verifiedAt.getTime() + RESET_AUTHORIZATION_TTL_MS,
      recovery.expiresAt.getTime()
    )
  );

  // Only the current, unexpired code can complete verification.
  // A second successful request cannot overwrite the authorization.
  const verifiedRecovery =
    await AdminPasswordReset.findOneAndUpdate(
      {
        _id: recovery._id,
        stage: "otp",
        consumedAt: null,
        otpVerifier: recovery.otpVerifier,
        expiresAt: { $gt: verifiedAt },
        otpExpiresAt: { $gt: verifiedAt },
      },
      {
        $set: {
          stage: "verified",
          otpVerifiedAt: verifiedAt,
          otpVerifier: null,
          otpExpiresAt: null,
          resetAuthorizationHash:
            hashRecoveryToken(rawResetAuthorization),
          resetAuthorizationExpiresAt,
        },
      },
      {
        new: true,
      }
    );

  if (!verifiedRecovery) {
    return next(
      new AppError(
        "The verification request changed or expired. Please request a new reset link.",
        400
      )
    );
  }

  return ApiResponse.success(res, {
    statusCode: 200,
    message:
      "Email verified. You can now enter your new admin password.",
    data: {
      resetAuthorization: rawResetAuthorization,
      resetAuthorizationExpiresAt,
    },
  });
});

exports.resetAdminPassword = catchAsync(async (req, res, next) => {
  const {
    challengeId,
    resetAuthorization,
    password,
    confirmPassword,
  } = req.body;

  if (
    typeof challengeId !== "string" ||
    !/^[a-fA-F0-9]{24}$/.test(challengeId)
  ) {
    return next(
      new AppError(
        "Invalid recovery request. Please request a new reset link.",
        400
      )
    );
  }

  if (
    typeof resetAuthorization !== "string" ||
    !/^[a-f0-9]{64}$/.test(resetAuthorization)
  ) {
    return next(
      new AppError(
        "Password reset authorization is invalid. Please verify your email again.",
        400
      )
    );
  }

  if (
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return next(
      new AppError(
        "Password and confirm password are required.",
        400
      )
    );
  }

  if (password.length < 8) {
    return next(
      new AppError(
        "Password must be at least 8 characters long.",
        400
      )
    );
  }

  if (password !== confirmPassword) {
    return next(
      new AppError("Passwords do not match.", 400)
    );
  }

  const authorizationHash =
    hashRecoveryToken(resetAuthorization);

  let changedUser;

  await mongoose.connection.transaction(async (session) => {
    const now = new Date();

    // Consume only an unexpired authorization issued after OTP verification.
    const recovery = await AdminPasswordReset.findOneAndUpdate(
      {
        _id: challengeId,
        stage: "verified",
        consumedAt: null,
        otpVerifiedAt: { $ne: null },
        expiresAt: { $gt: now },
        resetAuthorizationExpiresAt: { $gt: now },
        resetAuthorizationHash: authorizationHash,
      },
      {
        $set: {
          stage: "consumed",
          consumedAt: now,
          resetAuthorizationHash: null,
        },
      },
      {
        new: true,
        session,
      }
    );

    if (!recovery) {
      throw new AppError(
        "Your password reset authorization is invalid, expired, or already used. Please request a new reset link.",
        400
      );
    }

    const user = await User.findOne({
      _id: recovery.user,
      role: "admin",
      isActive: true,
    }).session(session);

    if (!user) {
      throw new AppError(
        "This admin recovery request is no longer valid.",
        400
      );
    }

    user.password = password;

    // Runs the password-hashing hook in your User model.
    await user.save({ session });

    // Invalidate all recovery requests for this account.
    await AdminPasswordReset.deleteMany(
      {
        user: user._id,
      },
      {
        session,
      }
    );

    await PasswordResetToken.deleteMany(
      {
        user: user._id,
      },
      {
        session,
      }
    );

    changedUser = {
      name: user.name,
      email: user.email,
    };
  });

  // The password has changed. Notification failure must not fail the reset.
  try {
    const notification = emailTemplate({
      name: changedUser.name,
      subject: "Your Supermarket admin password was changed",
      title: "Admin password changed successfully",
      message:
        "Your admin password has been reset successfully. You can now sign in with your new password.",
      buttonText: "Admin Log In",
      buttonUrl: new URL(
        "/admin/login",
        process.env.FRONTEND_URL
      ).toString(),
      notice:
        "If you did not make this password change, contact Supermarket support immediately.",
    });

    await sendEmail({
      to: changedUser.email,
      subject: notification.subject,
      text: notification.text,
      html: notification.html,
    });
  } catch (error) {
    console.error(
      "Admin password-change notification could not be sent:",
      error.message
    );
  }

  return ApiResponse.success(res, {
    statusCode: 200,
    message:
      "Admin password reset successful. You can now log in with your new password.",
  });
});