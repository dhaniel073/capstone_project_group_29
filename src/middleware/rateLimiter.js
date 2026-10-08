const rateLimit = require("express-rate-limit");
const ApiResponse = require("../utils/apiResponse");

const createLimiter = (max, message) =>
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      return ApiResponse.error(res, {
        statusCode: 429,
        message,
      });
    },
  });

const globalLimiter = createLimiter(
  100,
  "Too many requests from this IP. Please try again after 15 minutes."
);

const authLimiter = createLimiter(
  100,
  "Too many login or registration attempts. Please wait 15 minutes before trying again."
);

const passwordResetLimiter = createLimiter(
  15,
  "Too many password-reset requests. Please wait 15 minutes before trying again."
);

module.exports = {
  globalLimiter,
  authLimiter,
  passwordResetLimiter,
};