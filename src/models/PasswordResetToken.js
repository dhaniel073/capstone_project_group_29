const mongoose = require("mongoose");

const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Store the SHA-256 hash only. Never store the raw reset token.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Exact expiration date: now + 20 minutes.
    expiresAt: {
      type: Date,
      required: true,
    },

    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/*
  This removes the document after its expiry time.

  Note:
  Your application must still check `expiresAt > new Date()` when validating,
  because MongoDB's TTL cleanup process is asynchronous and is not guaranteed
  to delete an expired document at the precise second it expires.
*/
passwordResetTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
  "PasswordResetToken",
  passwordResetTokenSchema
);