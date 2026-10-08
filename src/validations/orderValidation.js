const { z } = require("zod");

const addToCartSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
});

// What the mobile app sends AFTER Paystack's onSuccess callback fires.
const checkoutSchema = z.object({
  reference: z.string().min(1, "Payment reference is required"),
  deliveryAddress: z.string().min(1, "Delivery Address is required"),
});

module.exports = { addToCartSchema, checkoutSchema };
