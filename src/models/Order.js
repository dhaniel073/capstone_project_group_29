const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  priceAtPurchase: { type: Number, required: true, min: 0 },
});

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["processing", "completed", "cancelled"],
      default: "processing",
    },
    paymentReference: { type: String, required: true, unique: true },
    paymentStatus: { type: String, enum: ["paid", "failed"], default: "paid" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
