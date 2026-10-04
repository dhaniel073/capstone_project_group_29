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

  if (!reference || typeof reference !== "string") {
    return next(new AppError("A valid payment reference is required", 400));
  }

  // Prevent one successful Paystack transaction from creating multiple orders.
  const alreadyUsed = await Payment.findOne({ reference });

  if (alreadyUsed) {
    return next(
      new AppError("This payment reference has already been processed", 409)
    );
  }

  /*
    Your verifyTransaction helper already returns Paystack's INNER `data`:

    {
      status: "success",
      amount: 150000,
      reference: "your-reference",
      currency: "NGN",
      channel: "card",
      gateway_response: "Successful",
      paid_at: "2026-10-04T..."
    }
  */
  const paystackData = await verifyTransaction(reference);

  console.log(
    "Verified Paystack transaction:",
    JSON.stringify(
      {
        reference: paystackData.reference,
        status: paystackData.status,
        amount: paystackData.amount,
        currency: paystackData.currency,
        channel: paystackData.channel,
      },
      null,
      2
    )
  );

  // Confirm that the payment itself succeeded.
  if (paystackData.status !== "success") {
    return next(new AppError("Payment was not successful", 400));
  }

  // Confirm that Paystack verified the same reference submitted by the client.
  if (paystackData.reference !== reference) {
    return next(new AppError("Payment reference mismatch", 400));
  }

  // This application accepts NGN payments only.
  if (paystackData.currency && paystackData.currency !== "NGN") {
    return next(
      new AppError("Payment was made with an unsupported currency", 400)
    );
  }

  const cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.product"
  );

  if (!cart || cart.items.length === 0) {
    return next(new AppError("Your cart is empty", 400));
  }

  let subtotal = 0;
  const orderItems = [];

  for (const item of cart.items) {
    const product = item.product;

    if (!product || !product.isActive) {
      return next(
        new AppError("A product in your cart is no longer available", 400)
      );
    }

    if (product.stock < item.quantity) {
      return next(
        new AppError(`Insufficient stock for ${product.name}`, 400)
      );
    }

    const price = Number(product.price);
    const quantity = Number(item.quantity);

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return next(
        new AppError(`Invalid product price or quantity for ${product.name}`, 400)
      );
    }

    subtotal += price * quantity;

    orderItems.push({
      product: product._id,
      name: product.name,
      quantity,
      priceAtPurchase: price,
    });
  }

  /*
    DELIVERY FEE

    Your checkout page currently displays a fixed ₦500 delivery fee.

    Important:
    Keep the fee calculated on the backend. Do not receive and trust
    `deliveryFee` directly from req.body, because a user can change it
    in the browser before sending the checkout request.
  */
  const deliveryFee = 500;

  // This is the complete amount your customer should pay.
  const totalAmount = subtotal + deliveryFee;

  /*
    Paystack returns NGN transaction amount in KOBO.

    Example for your screenshot:
    subtotal: ₦1,000
    deliveryFee: ₦500
    totalAmount: ₦1,500
    expectedKobo: 150000
    Paystack amount: 150000
  */
  const expectedKobo = Math.round(totalAmount * 100);
  const paidKobo = Number(paystackData.amount);

  console.log({
    reference,
    subtotalNaira: subtotal,
    deliveryFeeNaira: deliveryFee,
    totalAmountNaira: totalAmount,
    expectedKobo,
    paidKobo,
    paidNaira: paidKobo / 100,
    paystackCurrency: paystackData.currency,
  });

  if (!Number.isInteger(paidKobo) || paidKobo < 1) {
    return next(
      new AppError("Paystack returned an invalid payment amount", 502)
    );
  }

  if (paidKobo !== expectedKobo) {
    return next(
      new AppError(
        `Payment amount does not match order total. Expected ₦${totalAmount.toFixed(
          2
        )}, but Paystack verified ₦${(paidKobo / 100).toFixed(2)}.`,
        400
      )
    );
  }

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,

    // Add these fields to the Order schema, shown below.
    subtotal,
    deliveryFee,

    // This is product subtotal + delivery fee.
    totalAmount,

    status: "processing",
    paymentReference: reference,
    paymentStatus: "paid",
  });

  await Payment.create({
    order: order._id,
    user: req.user._id,
    reference,

    // The payment record must store the full amount actually charged.
    amount: totalAmount,

    status: "success",
    channel: paystackData.channel || null,
    gatewayResponse: paystackData.gateway_response || null,
    paidAt: paystackData.paid_at
      ? new Date(paystackData.paid_at)
      : null,
    rawVerifyResponse: paystackData,
  });

  // Reduce product stock only after payment amount verification succeeds.
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: {
        stock: -item.quantity,
      },
    });
  }

  // Empty the customer cart after the successful order.
  cart.items = [];
  await cart.save();

  return ApiResponse.success(res, {
    statusCode: 201,
    message: "Payment verified and order placed successfully",
    data: order,
  });
});