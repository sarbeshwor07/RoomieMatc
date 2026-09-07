/**
 * authRoutes.js — Authentication endpoints.
 */
const express   = require("express");
const rateLimit = require("express-rate-limit");
const router    = express.Router();

const {
  register,
  login,
  googleAuthCallback,
  verifyGoogleOtp,
  resendOtp,
  getMe,
  sendEmailVerification,
  confirmEmailVerification,
} = require("../controllers/authController");

const {
  forgotPassword,
  resetPassword,
  changePassword
} = require("../controllers/passwordController");

const { requireAuth } = require("../middleware/auth");

// ── Rate limiters ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: { error: "Too many authentication requests. Please try again later." },
  standardHeaders: true, legacyHeaders: false
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, max: 30,
  message: { error: "Too many OTP attempts. Please wait and try again." }
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: "Too many password reset requests. Please try again later." }
});

// ── Email / password ───────────────────────────────────────────────────────
router.post("/register",          authLimiter,     register);
router.post("/login",             authLimiter,     login);

// ── Google OAuth ───────────────────────────────────────────────────────────
router.post("/google",            authLimiter,     googleAuthCallback);

// ── OTP ────────────────────────────────────────────────────────────────────
router.post("/otp/verify",        otpLimiter,      verifyGoogleOtp);
router.post("/otp/resend",        otpLimiter,      resendOtp);

// ── Password management ────────────────────────────────────────────────────
router.post("/forgot-password",   passwordLimiter, forgotPassword);
router.post("/reset-password",    passwordLimiter, resetPassword);
router.patch("/change-password",  requireAuth,     changePassword);

// ── Current user ───────────────────────────────────────────────────────────
router.get("/me",                       requireAuth,     getMe);

// ── Email verification ─────────────────────────────────────────────────────
router.post("/send-verification",       requireAuth,     sendEmailVerification);
router.get("/verify-email",                              confirmEmailVerification);

module.exports = router;
