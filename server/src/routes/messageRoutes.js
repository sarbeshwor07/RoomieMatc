/**
 * messageRoutes.js
 *
 * GET    /api/messages/unread-count                           Unread message count
 * GET    /api/messages/conversations                          List own conversations
 * POST   /api/messages/conversations                          Get or create conversation
 * GET    /api/messages/conversations/:id                      Single conversation detail
 * GET    /api/messages/conversations/:id/messages             Paginated messages
 * POST   /api/messages/conversations/:id/messages             Send a message
 * PATCH  /api/messages/conversations/:id/read                 Mark conversation as read
 */
const express   = require("express");
const rateLimit = require("express-rate-limit");
const router    = express.Router();

const { requireAuth } = require("../middleware/auth");
const {
  listConversations,
  getOrCreateConversation,
  getConversation,
  listMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
  contactAdminSupport,
} = require("../controllers/messageController");

const sendLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  message: { error: "Too many messages. Please slow down." }
});

// Note: static sub-routes MUST come before /:id to avoid route collision
router.get("/unread-count",                   requireAuth, getUnreadCount);
router.post("/support",                       requireAuth, contactAdminSupport);
router.get("/conversations",                  requireAuth, listConversations);
router.post("/conversations",                 requireAuth, getOrCreateConversation);
router.get("/conversations/:id",              requireAuth, getConversation);
router.get("/conversations/:id/messages",     requireAuth, listMessages);
router.post("/conversations/:id/messages",    requireAuth, sendLimiter, sendMessage);
router.patch("/conversations/:id/read",       requireAuth, markConversationRead);

module.exports = router;
