const forgotPasswordEmailTemplate = ({ name, resetUrl }) => {
  const displayName = name || "there";
  const currentYear = new Date().getFullYear();

  const text = `
SUPERMARKET - PASSWORD RESET

Hello ${displayName},

We received a request to reset the password for your Supermarket account.

Use the secure link below to create a new password:
${resetUrl}

SECURITY NOTICE
This link expires in 20 minutes and can only be used once.

If you did not request a password reset, you can safely ignore this email.

© ${currentYear} Supermarket
`;

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f0fdf4;
      font-family: Arial, Helvetica, sans-serif;
      color: #14532d;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
      style="background-color: #f0fdf4; padding: 32px 16px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              max-width: 600px;
              background-color: #ffffff;
              border-radius: 14px;
              overflow: hidden;
              box-shadow: 0 8px 24px rgba(20, 83, 45, 0.1);
            "
          >
            <tr>
              <td
                style="
                  background-color: #00875a;
                  padding: 26px 32px;
                  text-align: center;
                "
              >
                <p
                  style="
                    margin: 0;
                    color: #ffffff;
                    font-size: 24px;
                    line-height: 1.2;
                    font-weight: 800;
                    letter-spacing: 0.4px;
                  "
                >
                  SUPERMARKET
                </p>

                <p
                  style="
                    margin: 7px 0 0;
                    color: #ffffff;
                    font-size: 13px;
                    line-height: 1.4;
                  "
                >
                  Fresh groceries, delivered with care
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 36px 32px 28px;">
                <h1
                  style="
                    margin: 0 0 16px;
                    color: #14532d;
                    font-size: 27px;
                    line-height: 1.3;
                    font-weight: 700;
                  "
                >
                  Reset your password
                </h1>

                <p
                  style="
                    margin: 0 0 18px;
                    color: #374151;
                    font-size: 16px;
                    line-height: 1.65;
                  "
                >
                  Hello ${displayName},
                </p>

                <p
                  style="
                    margin: 0 0 24px;
                    color: #374151;
                    font-size: 16px;
                    line-height: 1.65;
                  "
                >
                  We received a request to reset the password for your
                  Supermarket account. Click the button below to choose a new,
                  secure password.
                </p>

                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="margin: 0 0 28px;"
                >
                  <tr>
                    <td
                      align="center"
                      bgcolor="#00875a"
                      style="
                        border-radius: 8px;
                        background-color: #00875a;
                      "
                    >
                      <a
                        href="${resetUrl}"
                        target="_blank"
                        style="
                          display: inline-block;
                          padding: 14px 26px;
                          color: #ffffff;
                          font-size: 16px;
                          line-height: 1;
                          font-weight: 700;
                          text-decoration: none;
                          border-radius: 8px;
                        "
                      >
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>

                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    margin: 0 0 24px;
                    background-color: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 8px;
                  "
                >
                  <tr>
                    <td style="padding: 16px 18px;">
                      <p
                        style="
                          margin: 0 0 5px;
                          color: #166534;
                          font-size: 14px;
                          line-height: 1.5;
                          font-weight: 700;
                        "
                      >
                        Security notice
                      </p>

                      <p
                        style="
                          margin: 0;
                          color: #374151;
                          font-size: 14px;
                          line-height: 1.55;
                        "
                      >
                        This link expires in 20 minutes and can be used only
                        once. If you did not request a password reset, you can
                        safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>

                <p
                  style="
                    margin: 0;
                    color: #4b5563;
                    font-size: 13px;
                    line-height: 1.55;
                  "
                >
                  If the button does not work, copy and paste this link into
                  your browser:
                </p>

                <p
                  style="
                    margin: 8px 0 0;
                    color: #00875a;
                    font-size: 12px;
                    line-height: 1.55;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                  "
                >
                  ${resetUrl}
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 20px 32px;
                  background-color: #ffffff;
                  border-top: 1px solid #bbf7d0;
                  text-align: center;
                "
              >
                <p
                  style="
                    margin: 0;
                    color: #4b5563;
                    font-size: 12px;
                    line-height: 1.5;
                  "
                >
                  © ${currentYear} Supermarket. All rights reserved.
                </p>

                <p
                  style="
                    margin: 5px 0 0;
                    color: #4b5563;
                    font-size: 12px;
                    line-height: 1.5;
                  "
                >
                  This is an automated security email. Please do not reply.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

  return {
    subject: "Reset your Supermarket password",
    text,
    html,
  };
};

module.exports = forgotPasswordEmailTemplate;