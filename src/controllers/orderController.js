const Order = require("../models/Order");
const AppError = require("../utils/AppError");
const ApiResponse = require("../utils/apiResponse");
const catchAsync = require("../utils/catchAsync");


exports.getMyOrders = catchAsync(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  return ApiResponse.success(res, { message: "Orders fetched successfully", data: orders });
});

exports.getOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError("Order not found", 404));

  const isOwner = order.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== "admin") {
    return next(new AppError("You do not have permission to view this order", 403));
  }

  return ApiResponse.success(res, { message: "Order fetched successfully", data: order });
});

exports.getAllOrders = catchAsync(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    Order.find(filter).populate("user", "name email").sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Order.countDocuments(filter),
  ]);

  return ApiResponse.success(res, {
    message: "Orders fetched successfully",
    data: orders,
    meta: { currentPage: pageNum, pageSize: limitNum, totalRecords: total, totalPages: Math.ceil(total / limitNum) },
  });
});

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const allowedStatuses = ["processing", "completed", "cancelled"];
  if (!allowedStatuses.includes(status)) return next(new AppError("Invalid status value", 400));

  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
  if (!order) return next(new AppError("Order not found", 404));

  return ApiResponse.success(res, { message: "Order status updated successfully", data: order });
});
