const mongoose = require("mongoose");

const adminPasswordResetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Hash of the random token sent in the email link.
    linkTokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    // Overall recovery deadline: 20 minutes after creation.
    expiresAt: {
      type: Date,
      required: true,
    },

    stage: {
      type: String,
      enum: ["link", "otp", "verified", "consumed"],
      default: "link",
      required: true,
    },

    // Keyed verifier of the email OTP, never the plaintext OTP.
    otpVerifier: {
      type: String,
      default: null,
      select: false,
    },

    otpExpiresAt: {
      type: Date,
      default: null,
    },

    // Total failed guesses for this recovery request.
    // Resending must not reset this counter.
    otpAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    otpSendCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastOtpSentAt: {
      type: Date,
      default: null,
    },

    otpVerifiedAt: {
      type: Date,
      default: null,
    },

    // Hash of a separate random authorization issued after OTP verification.
    resetAuthorizationHash: {
      type: String,
      default: null,
      select: false,
    },

    resetAuthorizationExpiresAt: {
      type: Date,
      default: null,
    },

    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Cleanup only. Controllers must also check expiration explicitly.
adminPasswordResetSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
  "AdminPasswordReset",
  adminPasswordResetSchema
);