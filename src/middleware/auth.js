const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const User = require("../models/User");
const catchAsync = require("../utils/catchAsync");

exports.protect = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("You are not logged in. Please log in to continue.", 401));
  }

  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new AppError("Invalid or expired token.", 401));
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    return next(new AppError("User no longer exists or is inactive.", 401));
  }

  req.user = user;
  next();
});

exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError("You do not have permission to perform this action.", 403));
  }
  next();
};
