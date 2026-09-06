/**
 * index.js — RoomieMatch Express + Socket.io server entry point.
 *
 * HTTP REST API  →  http://localhost:4000/api
 * Socket.io      →  ws://localhost:4000  (same port, upgraded connection)
 *
 * Socket.io auth: JWT passed in handshake.auth.token or handshake.query.token
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const http    = require("http");
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const path    = require("path");
const { Server } = require("socket.io");

const { initDatabase } = require("./database/init");
const { registerSocketHandlers } = require("./socket/socketHandler");

// ── Route modules ──────────────────────────────────────────────────────────
const authRoutes         = require("./routes/authRoutes");
const uploadRoutes       = require("./routes/uploadRoutes");
const userRoutes         = require("./routes/userRoutes");
const propertyRoutes     = require("./routes/propertyRoutes");
const applicationRoutes  = require("./routes/applicationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const favouriteRoutes    = require("./routes/favouriteRoutes");
const reportRoutes       = require("./routes/reportRoutes");
const adminRoutes        = require("./routes/adminRoutes");
const messageRoutes      = require("./routes/messageRoutes");
const reviewRoutes       = require("./routes/reviewRoutes");
const compatibilityRoutes = require("./routes/compatibilityRoutes");

const rateLimit = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 4000;

// Enable reverse proxy trust (Render, Railway, Vercel, Cloudflare, etc.)
app.set("trust proxy", 1);

// ── Create HTTP server (required for Socket.io to share port) ─────────────
const httpServer = http.createServer(app);

// ── Allowed origins ────────────────────────────────────────────────────────
// Support local dev, configured URLs, comma-separated ALLOWED_ORIGINS, and *.vercel.app
const isDev = (process.env.NODE_ENV || "development") !== "production";

const customOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  process.env.ADMIN_URL  || "http://localhost:5174",
  ...customOrigins,
];

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin / server-to-server / curl / Postman
  if (allowedOrigins.includes(origin)) return true;
  // Allow all Vercel deployment URLs (production and preview branches)
  if (/^https:\/\/[a-zA-Z0-9-_\.]+\.vercel\.app$/.test(origin)) return true;
  // In development: accept any http://localhost:* or http://127.0.0.1:* or any local network IP
  if (isDev && /^http:\/\/(localhost|127\.0\.0\.1|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin)) return true;
  return false;
}

// ── Socket.io setup ────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    methods:     ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout:  60000,
});

// Register all Socket.io event handlers
registerSocketHandlers(io);

// ── Expose io instance globally so controllers can emit events ─────────────
app.set("io", io);

// ── Security headers (Helmet) ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// ── Rate Limiters (Firewall Protection) ─────────────────────────────────────
// 1. General API rate limiter: max 300 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP. Please try again in 15 minutes." },
});

// 2. Auth rate limiter: max 25 attempts per 15 minutes per IP to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts from this IP. Please try again in 15 minutes." },
});

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Body parsers ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Apply rate limits ──────────────────────────────────────────────────────
app.use("/api/auth", authLimiter);
app.use("/api", generalLimiter);

// ── Static file serving ────────────────────────────────────────────────────
app.use("/api/uploads/profiles",   express.static(path.resolve(__dirname, "../uploads/profiles")));
app.use("/api/uploads/properties", express.static(path.resolve(__dirname, "../uploads/properties")));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);
app.use("/api",               uploadRoutes);
app.use("/api/users",         userRoutes);
app.use("/api/properties",    propertyRoutes);
app.use("/api/applications",  applicationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/favourites",    favouriteRoutes);
app.use("/api/reports",       reportRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/messages",      messageRoutes);
app.use("/api/reviews",       reviewRoutes);
app.use("/api/compatibility", compatibilityRoutes);

// ── Health check ───────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    socket_connections: io.engine.clientsCount,
  });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[Server Error]", err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "An unexpected error occurred." });
});

// ── Start ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await initDatabase();
    httpServer.listen(PORT, () => {
      console.log(`\n🏠 RoomieMatch API     →  http://localhost:${PORT}/api`);
      console.log(`   Socket.io          →  ws://localhost:${PORT}`);
      console.log(`   Health check       →  http://localhost:${PORT}/api/health`);
      console.log(`   Environment        →  ${process.env.NODE_ENV || "development"}\n`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
