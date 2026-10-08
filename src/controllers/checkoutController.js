const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const AppError = require("../utils/AppError");
const ApiResponse = require("../utils/apiResponse");
const catchAsync = require("../utils/catchAsync");
const { verifyTransaction } = require("../services/paystackService");
const emailTemplate = require("../EmailTemplates/emailTemplate");
const sendEmail = require("../utils/sendEmail");

const crypto = require("crypto");
const DELIVERY_FEE = 500;

exports.initializeCheckout = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate({
    path: "items.product",
    select: "name price",
  });

  if (!cart || cart.items.length === 0) {
    return next(new AppError("Your cart is empty", 400));
  }

  const subtotal = cart.items.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );
  const total = subtotal + DELIVERY_FEE;
  const reference = `SMKT-${crypto.randomUUID()}`;

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: req.user.email,
      amount: Math.round(total * 100), // kobo
      currency: "NGN",
      reference,
      metadata: { userId: String(req.user._id), cartId: String(cart._id) },
    }),
  });
  const json = await response.json();

  if (!response.ok || !json.status) {
    return next(new AppError(json.message || "Unable to start payment", 502));
  }

  return ApiResponse.success(res, {
    statusCode: 200,
    message: "Payment initialized",
    data: { access_code: json.data.access_code, reference: json.data.reference },
  });
});

// POST /api/checkout
// Called by the webapp right after Paystack's onSuccess callback fires
// with a transaction reference. This is the ONLY place an order gets created
// and stock gets deducted for a paid order.
//
// Security note: we never trust the client's "it succeeded" claim by itself.
// We independently call Paystack's Verify Transaction endpoint using our
// secret key, and we re-check the amount against the customer's current cart
// total before creating anything. This blocks a tampered/replayed reference
// from ever crediting an order.
exports.checkout = catchAsync(async (req, res, next) => {
  const { reference, deliveryAddress } = req.body;

  console.log("Checkout body keys:", Object.keys(req.body || {}));
  console.log("Address value:", JSON.stringify(deliveryAddress));
  console.log("Address type:", typeof deliveryAddress);

  if (!reference || typeof reference !== "string") {
    return next(new AppError("A valid payment reference is required", 400));
  }

  if (
    typeof deliveryAddress !== "string" ||
    !deliveryAddress.trim()
  ) {
    return next(new AppError("A delivery address is required", 400));
  }

  const normalizedDeliveryAddress = deliveryAddress.trim();

  if (normalizedDeliveryAddress.length > 1000) {
    return next(
      new AppError("Delivery address must not exceed 1000 characters", 400)
    );
  }

  // Prevent one successful Paystack transaction from creating multiple orders.
  const alreadyUsed = await Payment.findOne({ reference });

  if (alreadyUsed) {
    return next(
      new AppError("This payment reference has already been processed", 409)
    );
  }

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

  const deliveryFee = 500;

  // This is the complete amount your customer should pay.
  const totalAmount = subtotal + deliveryFee;

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

  deliveryAddress: normalizedDeliveryAddress,

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

  const orderEmail = emailTemplate({
    name: req.user.name,
    subject: `Order confirmed - ${order._id}`,
    title: "Your order is confirmed",
    message: `We have received your payment of ₦${totalAmount.toLocaleString(
      "en-NG"
    )}. Your order is now being processed and we will notify you when it is on its way.`,
    buttonText: "View My Orders",
    buttonUrl: `${process.env.FRONTEND_URL}/orders`,
    notice: `Order reference: ${order._id}. Payment reference: ${reference}.`,
  });

  try {
    await sendEmail({
      to: req.user.email,
      subject: orderEmail.subject,
      text: orderEmail.text,
      html: orderEmail.html,
    });
  } catch (error) {
    /*
      Never make a paid order fail because confirmation email failed.
    */
    console.error("Order confirmation email could not be sent:", error.message);
  }

  return ApiResponse.success(res, {
    statusCode: 201,
    message: "Payment verified and order placed successfully",
    data: order,
  });
});