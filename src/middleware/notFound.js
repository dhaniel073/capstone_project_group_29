const ApiResponse = require("../utils/apiResponse");

const notFound = (req, res) => {
  return ApiResponse.error(res, { statusCode: 404, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

module.exports = notFound;
