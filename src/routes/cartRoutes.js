const express = require("express");
const { getCart, addToCart, removeFromCart } = require("../controllers/cartController");
const { protect, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { addToCartSchema } = require("../validations/orderValidation");

const router = express.Router();

router.use(protect, restrictTo("customer"));

router.get("/", getCart);
router.post("/", validate(addToCartSchema), addToCart);
router.delete("/:productId", removeFromCart);

module.exports = router;
