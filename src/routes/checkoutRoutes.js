const express = require("express");
const { checkout } = require("../controllers/checkoutController");
const { initializeCheckout } = require("../controllers/checkoutController");
const { protect, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { checkoutSchema } = require("../validations/orderValidation");

const router = express.Router();

// Called by the mobile app right after Paystack's onSuccess fires.
router.post("/", protect, restrictTo("customer"), validate(checkoutSchema), checkout);
router.post("/init", protect, restrictTo("customer"), initializeCheckout);

module.exports = router;
