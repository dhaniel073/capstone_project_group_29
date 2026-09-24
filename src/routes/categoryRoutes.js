const express = require("express");
const { createCategory, getCategories, updateCategory, deleteCategory } = require("../controllers/categoryController");
const { protect, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { categorySchema } = require("../validations/categoryValidation");

const router = express.Router();

router.get("/", getCategories);
router.post("/", protect, restrictTo("admin"), validate(categorySchema), createCategory);
router.put("/:id", protect, restrictTo("admin"), validate(categorySchema), updateCategory);
router.delete("/:id", protect, restrictTo("admin"), deleteCategory);

module.exports = router;
