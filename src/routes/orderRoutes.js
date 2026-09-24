const express = require("express");
const { getMyOrders, getOrderById, getAllOrders, updateOrderStatus } = require("../controllers/orderController");
const { protect, restrictTo } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, restrictTo("customer"), getMyOrders);
router.get("/:id", protect, getOrderById);

router.get("/admin/all", protect, restrictTo("admin"), getAllOrders);
router.put("/admin/:id/status", protect, restrictTo("admin"), updateOrderStatus);

module.exports = router;
