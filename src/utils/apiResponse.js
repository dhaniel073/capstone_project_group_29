class ApiResponse {
  static success(res, { statusCode = 200, message = "Success", data = null, meta = null }) {
    const body = { success: true, message, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  static error(res, { statusCode = 500, message = "Something went wrong", data = null }) {
    return res.status(statusCode).json({ success: false, message, data });
  }
}

module.exports = ApiResponse;
