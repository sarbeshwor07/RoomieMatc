/**
 * socketHandler.js — Socket.io event logic for RoomieMatch real-time chat.
 *
 * Authentication:
 *   Every socket connection requires a valid JWT passed in the handshake auth:
 *     socket.handshake.auth.token  OR  socket.handshake.query.token
 *   The auth middleware verifies the token and attaches req.user to socket.user.
 *
 * Room strategy:
 *   Each conversation is a Socket.io room keyed by its UUID.
 *   Users join rooms when they open a conversation (client emits join_conversation).
 *   Messages are emitted to the room — all participants receive them instantly.
 *
 * Events (client → server):
 *   join_conversation  { conversationId }   — join a room + mark messages as read
 *   leave_conversation { conversationId }   — leave a room
 *   send_message       { conversationId, body } — save to DB + broadcast to room
 *   typing             { conversationId, isTyping } — broadcast typing indicator
 *
 * Events (server → client):
 *   new_message        { message }          — new message in a room
 *   message_read       { conversationId, readBy } — messages marked as read
 *   user_typing        { conversationId, userId, userName, isTyping }
 *   error              { message }          — sent back to the originating socket
 *   connected          { userId }           — confirms successful connection
 */
const jwt  = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { run, get, all } = require("../database/db");
const { createNotification } = require("../controllers/notificationController");

function isoDate(v) {
  return !v ? null : v instanceof Date ? v.toISOString() : v;
}

// ── JWT Auth Middleware for Socket.io ─────────────────────────────────────
function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;

    if (!token) {
      return next(new Error("Authentication token required."));
    }

    const secret = process.env.JWT_SECRET || "roomiematch_dev_secret_change_in_production_abc123xyz";
    const decoded = jwt.verify(token, secret);

    // Attach user info to socket — decoded.sub is userId
    socket.userId   = decoded.sub;
    socket.userName = null; // will be populated on first DB call
    return next();
  } catch (err) {
    return next(new Error("Invalid or expired token."));
  }
}

// ── Main socket handler ───────────────────────────────────────────────────
function registerSocketHandlers(io) {

  // Apply auth middleware to all connections
  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    const userId = socket.userId;

    // Fetch user name for display in typing indicators
    try {
      const user = await get("SELECT id, name FROM users WHERE id = ?", [userId]);
      socket.userName = user?.name || "User";
    } catch {
      socket.userName = "User";
    }

    console.log(`[Socket] Connected: ${socket.userName} (${userId.slice(0, 8)}) id=${socket.id}`);

    // Join personal user rooms for direct notifications and real-time alerts
    socket.join(userId);
    socket.join(`user_${userId}`);

    // Confirm connection to client
    socket.emit("connected", { userId });

    // ── join_conversation ─────────────────────────────────────────────────
    socket.on("join_conversation", async ({ conversationId } = {}) => {
      if (!conversationId) {
        return socket.emit("error", { message: "conversationId is required." });
      }

      // Verify this user is a participant
      const participant = await get(
        "SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
        [conversationId, userId]
      ).catch(() => null);

      if (!participant) {
        return socket.emit("error", { message: "Access denied to conversation." });
      }

      // Join the Socket.io room
      socket.join(conversationId);
      console.log(`[Socket] ${socket.userName} joined room ${conversationId.slice(0, 8)}`);

      // Mark all incoming messages as read when joining
      await run(
        "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0",
        [conversationId, userId]
      ).catch(() => {});

      // Notify the room that messages were read
      io.to(conversationId).emit("message_read", {
        conversationId,
        readBy: userId,
      });
    });

    // ── leave_conversation ────────────────────────────────────────────────
    socket.on("leave_conversation", ({ conversationId } = {}) => {
      if (!conversationId) return;
      socket.leave(conversationId);
      console.log(`[Socket] ${socket.userName} left room ${conversationId.slice(0, 8)}`);
    });

    // ── send_message ──────────────────────────────────────────────────────
    socket.on("send_message", async ({ conversationId, body } = {}) => {
      if (!conversationId || !body?.trim()) {
        return socket.emit("error", { message: "conversationId and body are required." });
      }

      // Verify participation
      const participant = await get(
        "SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
        [conversationId, userId]
      ).catch(() => null);

      if (!participant) {
        return socket.emit("error", { message: "Access denied." });
      }

      try {
        // Persist message to MySQL
        const msgId = uuidv4();
        await run(
          "INSERT INTO messages (id, conversation_id, sender_id, body, is_read) VALUES (?, ?, ?, ?, 0)",
          [msgId, conversationId, userId, body.trim()]
        );

        // Fetch full message with sender info for broadcast
        const msg = await get(
          `SELECT m.id, m.conversation_id, m.sender_id, m.body, m.is_read, m.created_at,
                  u.name AS sender_name, u.profile_image AS sender_image
           FROM messages m JOIN users u ON m.sender_id = u.id
           WHERE m.id = ?`,
          [msgId]
        );

        const msgPayload = { ...msg, created_at: isoDate(msg.created_at) };

        // Broadcast to ALL sockets in the conversation room (including sender)
        io.to(conversationId).emit("new_message", { message: msgPayload });

        console.log(`[Socket] Message in ${conversationId.slice(0, 8)} from ${socket.userName}`);

        // Send in-app notification to other participants (non-fatal)
        const others = await all(
          "SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?",
          [conversationId, userId]
        ).catch(() => []);

        for (const p of others) {
          // Deliver live message event directly to participant's socket rooms
          io.to(p.user_id).emit("new_message", { message: msgPayload });
          io.to(`user_${p.user_id}`).emit("new_message", { message: msgPayload });

          createNotification(
            p.user_id,
            "New Message",
            `${socket.userName} sent you a message.`,
            "message",
            conversationId
          ).catch(() => {});
        }
      } catch (err) {
        console.error("[Socket] send_message error:", err.message);
        socket.emit("error", { message: "Failed to send message." });
      }
    });

    // ── typing indicator ──────────────────────────────────────────────────
    socket.on("typing", ({ conversationId, isTyping } = {}) => {
      if (!conversationId) return;
      // Broadcast to everyone else in the room
      socket.to(conversationId).emit("user_typing", {
        conversationId,
        userId,
        userName:  socket.userName,
        isTyping:  !!isTyping,
      });
    });

    // ── disconnect ────────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${socket.userName} (${reason})`);
    });

    // ── error (client-side socket error) ─────────────────────────────────
    socket.on("error", (err) => {
      console.error("[Socket] Client error:", err.message);
    });
  });
}

module.exports = { registerSocketHandlers };
