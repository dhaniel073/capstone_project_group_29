const rateLimit = require("express-rate-limit");
const ApiResponse = require("../utils/apiResponse");

// 1. General API limiter (replaces in-line app.js limiter)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(res, {
      statusCode: 429,
      message:
        "Too many requests from this IP. Please try again after 15 minutes.",
    });
  },
});

// 2. Strict Auth limiter to prevent brute-force attacks on login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(res, {
      statusCode: 429,
      message:
        "Too many login/registration attempts. Please wait 15 minutes before trying again.",
    });
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
};
