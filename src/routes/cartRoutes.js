const express = require("express");
const { getCart, addToCart, removeFromCart,removeOneFromCart, addOneToCart } = require("../controllers/cartController");
const { protect, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { addToCartSchema } = require("../validations/orderValidation");

const router = express.Router();

router.use(protect, restrictTo("customer"));

router.get("/", getCart);
router.post("/", validate(addToCartSchema), addToCart);
router.post("/remove-one/:productId", removeOneFromCart);
router.post("/add-one/:productId", addOneToCart);
router.delete("/:productId", removeFromCart);

module.exports = router;
