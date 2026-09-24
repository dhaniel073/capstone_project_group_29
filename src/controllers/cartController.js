const Cart = require("../models/Cart");
const Product = require("../models/Product");
const AppError = require("../utils/AppError");
const ApiResponse = require("../utils/apiResponse");
const catchAsync = require("../utils/catchAsync");

exports.getCart = catchAsync(async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id }).populate("items.product", "name price stock imageUrl");
  if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });
  return ApiResponse.success(res, { message: "Cart fetched successfully", data: cart });
});

exports.addToCart = catchAsync(async (req, res, next) => {
  const { productId, quantity } = req.body;
  const product = await Product.findById(productId);
  if (!product || !product.isActive) return next(new AppError("Product not found", 404));
  if (product.stock < quantity) {
    return next(new AppError(`Only ${product.stock} unit(s) of ${product.name} available`, 400));
  }

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

  const existingItem = cart.items.find((item) => item.product.toString() === productId);
  if (existingItem) existingItem.quantity += quantity;
  else cart.items.push({ product: productId, quantity });

  await cart.save();
  await cart.populate("items.product", "name price stock imageUrl");

  return ApiResponse.success(res, { message: "Item added to cart", data: cart });
});

exports.removeFromCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new AppError("Cart not found", 404));

  cart.items = cart.items.filter((item) => item.product.toString() !== req.params.productId);
  await cart.save();

  return ApiResponse.success(res, { message: "Item removed from cart", data: cart });
});
