const { z } = require("zod");
const categorySchema = z.object({ name: z.string().min(2, "Category name is required") });
module.exports = { categorySchema };
