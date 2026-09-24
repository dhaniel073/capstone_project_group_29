const User = require("../models/User");
const AppError = require("../utils/AppError");
const ApiResponse = require("../utils/apiResponse");
const catchAsync = require("../utils/catchAsync");
const generateToken = require("../utils/generateToken");

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) return next(new AppError("An account with this email already exists", 409));

  const user = await User.create({ name, email, password, role: role || "customer" });
  const token = generateToken(user._id);

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
