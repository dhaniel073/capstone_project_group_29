const Category = require("../models/Category");
const AppError = require("../utils/AppError");
const ApiResponse = require("../utils/apiResponse");
const catchAsync = require("../utils/catchAsync");

exports.createCategory = catchAsync(async (req, res, next) => {
  const existing = await Category.findOne({ name: req.body.name });
  if (existing) return next(new AppError("Category already exists", 409));
  const category = await Category.create({ name: req.body.name });
  return ApiResponse.success(res, { statusCode: 201, message: "Category created successfully", data: category });
});

exports.getCategories = catchAsync(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  return ApiResponse.success(res, { message: "Categories fetched successfully", data: categories });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true, runValidators: true });
  if (!category) return next(new AppError("Category not found", 404));
  return ApiResponse.success(res, { message: "Category updated successfully", data: category });
});

exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return next(new AppError("Category not found", 404));
  return ApiResponse.success(res, { message: "Category deleted successfully", data: null });
});
