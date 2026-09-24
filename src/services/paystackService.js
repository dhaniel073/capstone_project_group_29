const AppError = require("../utils/AppError");

const PAYSTACK_BASE_URL = "https://api.paystack.co";

// Only the SECRET key is used here, and only ever from the backend.
// The mobile app only ever sees the PUBLIC key.
const verifyTransaction = async (reference) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!data.status) {
    throw new AppError(data.message || "Unable to verify payment with Paystack", 502);
  }

  return data.data; // { status, amount (kobo), currency, channel, gateway_response, paid_at, customer: { email }, ... }
};

module.exports = { verifyTransaction };
