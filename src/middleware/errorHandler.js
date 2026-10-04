const multer = require("multer");
const ApiResponse = require("../utils/apiResponse");

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong";

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "Image file is too large. Maximum allowed size is 5MB.";
    } else {
      message = err.message;
    }
  }

  // Errors thrown from your custom fileFilter (e.g. wrong file type)
  if (err.message && err.message.includes("formats are allowed")) {
    statusCode = 400;
    message = err.message;
  }

  if (err.name === "CastError") {
    console.log("CastError detected -> Path:", err.path, "| Value:", err.value);
    statusCode = 400;
    message = "Invalid ID format";
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `${field} already exists` : "Duplicate record";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map((val) => val.message).join(", ");
  }

  if (!err.isOperational && process.env.NODE_ENV !== "production") {
    console.error("UNEXPECTED ERROR:", err);
  }

  return ApiResponse.error(res, { statusCode, message, data: null });
};

module.exports = errorHandler;