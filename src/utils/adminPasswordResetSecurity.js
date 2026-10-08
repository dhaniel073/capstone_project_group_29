const crypto = require("crypto");

const LINK_TTL_MS = 20 * 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_AUTHORIZATION_TTL_MS = 5 * 60 * 1000;

const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_SENDS = 3;

const generateRecoveryToken = () =>
  crypto.randomBytes(32).toString("hex");

const hashRecoveryToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const generateOtp = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const getOtpSecret = () => {
  const secret = process.env.ADMIN_RESET_OTP_SECRET;

  if (
    typeof secret !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(secret)
  ) {
    throw new Error(
      "ADMIN_RESET_OTP_SECRET must be a 64-character hexadecimal secret"
    );
  }

  return Buffer.from(secret, "hex");
};

const createOtpVerifier = (challengeId, otp) =>
  crypto
    .createHmac("sha256", getOtpSecret())
    .update(`admin-password-reset:${String(challengeId)}:${otp}`)
    .digest("hex");

const matchesOtpVerifier = (challengeId, otp, storedVerifier) => {
  if (
    typeof storedVerifier !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(storedVerifier)
  ) {
    return false;
  }

  const expected = Buffer.from(
    createOtpVerifier(challengeId, otp),
    "hex"
  );

  const stored = Buffer.from(storedVerifier, "hex");

  return crypto.timingSafeEqual(expected, stored);
};

module.exports = {
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
};