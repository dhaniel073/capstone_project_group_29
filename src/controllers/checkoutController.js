const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const AppError = require("../utils/AppError");
const ApiResponse = require("../utils/apiResponse");
const catchAsync = require("../utils/catchAsync");
const { verifyTransaction } = require("../services/paystackService");

// POST /api/checkout
// Called by the mobile app right after Paystack's onSuccess callback fires
// with a transaction reference. This is the ONLY place an order gets created
// and stock gets deducted for a paid order.
//
// Security note: we never trust the client's "it succeeded" claim by itself.
// We independently call Paystack's Verify Transaction endpoint using our
// secret key, and we re-check the amount against the customer's current cart
// total before creating anything. This blocks a tampered/replayed reference
// from ever crediting an order.
exports.checkout = catchAsync(async (req, res, next) => {
  const { reference } = req.body;

  // Reject a reference that's already been used to create an order —
  // prevents replaying the same successful payment into multiple orders.
  const alreadyUsed = await Payment.findOne({ reference });
  if (alreadyUsed) {
    return next(new AppError("This payment reference has already been processed", 409));
  }

  const paystackData = await verifyTransaction(reference);

  if (paystackData.status !== "success") {
    return next(new AppError("Payment was not successful", 400));
  }

  const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
  if (!cart || cart.items.length === 0) {
    return next(new AppError("Your cart is empty", 400));
  }

  let totalAmount = 0;
  const orderItems = [];

  for (const item of cart.items) {
    const product = item.product;
    if (!product || !product.isActive) {
      return next(new AppError("A product in your cart is no longer available", 400));
    }
    if (product.stock < item.quantity) {
      return next(new AppError(`Insufficient stock for ${product.name}`, 400));
    }
    totalAmount += product.price * item.quantity;
    orderItems.push({
      product: product._id,
      name: product.name,
      quantity: item.quantity,
      priceAtPurchase: product.price,
    });
  }

  // Cross-check what was actually charged (in kobo) against the cart's
  // current total. If they don't match, someone tampered with the amount
  // client-side, or the cart changed between charge and checkout call.
  const expectedKobo = Math.round(totalAmount * 100);
  if (paystackData.amount !== expectedKobo) {
    return next(new AppError("Payment amount does not match cart total. Contact support with your reference.", 400));
  }

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    totalAmount,
    status: "processing",
    paymentReference: reference,
    paymentStatus: "paid",
  });

  await Payment.create({
    order: order._id,
    user: req.user._id,
    reference,
    amount: totalAmount,
    status: "success",
    channel: paystackData.channel || null,
    gatewayResponse: paystackData.gateway_response || null,
    paidAt: paystackData.paid_at ? new Date(paystackData.paid_at) : null,
    rawVerifyResponse: paystackData,
  });

  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: -item.quantity } });
  }

  cart.items = [];
  await cart.save();

  return ApiResponse.success(res, {
    statusCode: 201,
    message: "Payment verified and order placed successfully",
    data: order,
  });
});
