const { z } = require("zod");

const createProductSchema = z.object({
  name: z
    .string({ required_error: "Product name is required" })
    .min(2, "Product name must be at least 2 characters"),
  description: z.string().optional(),
  sku: z
    .string({ required_error: "SKU is required" })
    .min(2, "SKU must be at least 2 characters"),
  price: z.coerce
    .number({ invalid_type_error: "Price is required and must be a number" })
    .positive("Price must be greater than 0"),
  stock: z.coerce
    .number({ invalid_type_error: "Stock is required and must be a number" })
    .int()
    .min(0, "Stock cannot be negative"),
  category: z
    .string({ required_error: "Category is required" })
    .min(1, "Category is required"),
});

const updateProductSchema = createProductSchema.partial();

module.exports = { createProductSchema, updateProductSchema };