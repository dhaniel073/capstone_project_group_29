const express = require("express");
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct, getProductsByCategory } = require("../controllers/productController");
const { protect, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");
const upload = require("../middleware/uploadMiddleware");
const { createProductSchema, updateProductSchema } = require("../validations/productValidation");
const router = express.Router();

router.get("/", getProducts);
router.get("/:id", getProductById);
router.get("/category/:categoryId", getProductsByCategory);
router.post("/", protect, restrictTo("admin"), upload.single("image"), validate(createProductSchema), createProduct);
router.put("/:id", protect, restrictTo("admin"), upload.single("image"), validate(updateProductSchema), updateProduct);
router.delete("/:id", protect, restrictTo("admin"), deleteProduct);

module.exports = router;
