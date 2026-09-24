const express = require("express");
const { checkout } = require("../controllers/checkoutController");
const { protect, restrictTo } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { checkoutSchema } = require("../validations/orderValidation");

const router = express.Router();

// Called by the mobile app right after Paystack's onSuccess fires.
router.post("/", protect, restrictTo("customer"), validate(checkoutSchema), checkout);

module.exports = router;
