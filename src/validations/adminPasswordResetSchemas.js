const { z } = require("zod");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

const recoveryTokenSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Invalid recovery token");

const challengeIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid recovery challenge");

const adminForgotPasswordSchema = z.object({
  email: emailSchema,
});

const adminValidateResetTokenSchema = z.object({
  token: recoveryTokenSchema,
});

const adminSendResetOtpSchema = z.object({
  token: recoveryTokenSchema,
});

const adminVerifyResetOtpSchema = z.object({
  challengeId: challengeIdSchema,

  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit verification code"),
});

const adminResendResetOtpSchema = z.object({
  challengeId: challengeIdSchema,
});

const adminResetPasswordSchema = z
  .object({
    challengeId: challengeIdSchema,

    resetAuthorization: recoveryTokenSchema,

    password: z
      .string()
      .min(8, "Password must be at least 8 characters long"),

    confirmPassword: z
      .string()
      .min(8, "Confirm password must be at least 8 characters long"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

module.exports = {
  adminForgotPasswordSchema,
  adminValidateResetTokenSchema,
  adminSendResetOtpSchema,
  adminVerifyResetOtpSchema,
  adminResendResetOtpSchema,
  adminResetPasswordSchema,
};