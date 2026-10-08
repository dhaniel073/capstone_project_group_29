const { MailtrapClient } = require("mailtrap");

const sendEmail = async ({ to, subject, text, html }) => {
  const token = process.env.MAILTRAP_API_TOKEN;
  const fromEmail = process.env.MAILTRAP_FROM_EMAIL;

  if (!token || !fromEmail) {
    throw new Error(
      "MAILTRAP_API_TOKEN or MAILTRAP_FROM_EMAIL is missing"
    );
  }

  if (!to || !subject || (!text && !html)) {
    throw new Error(
      "Email recipient, subject, and text or HTML content are required"
    );
  }

  const client = new MailtrapClient({ token });

  const recipients = (Array.isArray(to) ? to : [to]).map(
    (recipient) =>
      typeof recipient === "string"
        ? { email: recipient }
        : recipient
  );

  const payload = {
    from: {
      email: fromEmail,
      name: process.env.MAILTRAP_FROM_NAME || "Capstone",
    },
    to: recipients,
    subject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
  };

  try {
    const info = await client.send(payload);

    console.log("Email accepted by Mailtrap");

    return info;
  } catch (error) {
    console.error("Mailtrap email send failed:", error.message);
    throw error;
  }
};

module.exports = sendEmail;