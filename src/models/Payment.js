const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NGN" },
    status: { type: String, enum: ["success", "failed"], required: true },
    channel: { type: String, default: null },
    gatewayResponse: { type: String, default: null },
    paidAt: { type: Date, default: null },
    rawVerifyResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
