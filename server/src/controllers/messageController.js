/**
 * messageController.js — Conversations and messages.
 *
 * A "conversation" is a thread between two users, optionally linked to a property.
 * Only two participants per conversation are supported (direct messaging).
 *
 * Endpoints:
 *   GET    /api/messages/conversations          List own conversations (with last message + unread count)
 *   POST   /api/messages/conversations          Get or create a conversation with another user
 *   GET    /api/messages/conversations/:id      Get a single conversation with all messages
 *   GET    /api/messages/conversations/:id/messages  Get paginated messages in a conversation
 *   POST   /api/messages/conversations/:id/messages  Send a message
 *   PATCH  /api/messages/conversations/:id/read      Mark all messages in conversation as read
 *   GET    /api/messages/unread-count           Total unread message count for the current user
 *
 * Authorization:
 *   - All routes require JWT authentication.
 *   - Users can only access conversations they are participants in.
 */
const { v4: uuidv4 } = require("uuid");
const { run, get, all } = require("../database/db");
const { createNotification } = require("./notificationController");

function isoDate(v) {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : v;
}

// ── Build a full conversation object ──────────────────────────────────────
async function buildConversation(convId, currentUserId) {
  const conv = await get("SELECT * FROM conversations WHERE id = ?", [convId]);
  if (!conv) return null;

  // Participants
  const participants = await all(
    `SELECT u.id, u.name, u.profile_image, u.role
     FROM conversation_participants cp
     JOIN users u ON cp.user_id = u.id
     WHERE cp.conversation_id = ?`,
    [convId]
  );

  // Last message
  const lastMsg = await get(
    `SELECT id, sender_id, body, is_read, created_at
     FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [convId]
  );

  // Unread count for this user
  const unreadRow = await get(
    `SELECT COUNT(*) AS cnt FROM messages
     WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`,
    [convId, currentUserId]
  );

  // Property info if linked
  let property = null;
  if (conv.property_id) {
    property = await get(
      "SELECT id, title, price, city FROM properties WHERE id = ?",
      [conv.property_id]
    );
  }

  return {
    id:          conv.id,
    property_id: conv.property_id,
    property:    property || null,
    created_at:  isoDate(conv.created_at),
    participants: participants.map(p => ({
      id:           p.id,
      name:         p.name,
      profile_image: p.profile_image,
      role:         p.role,
    })),
    last_message: lastMsg ? {
      id:         lastMsg.id,
      sender_id:  lastMsg.sender_id,
      body:       lastMsg.body,
      is_read:    lastMsg.is_read,
      created_at: isoDate(lastMsg.created_at)
    } : null,
    unread_count: unreadRow?.cnt || 0,
  };
}

// ── GET /api/messages/conversations ──────────────────────────────────────
async function listConversations(req, res) {
  try {
    const userId = req.user.id;

    // Get all conversation IDs where this user is a participant
    const convIds = await all(
      `SELECT conversation_id FROM conversation_participants WHERE user_id = ?`,
      [userId]
    );

    if (convIds.length === 0) return res.json({ conversations: [] });

    // Build each conversation object (sorted by last message desc)
    const conversations = await Promise.all(
      convIds.map(r => buildConversation(r.conversation_id, userId))
    );

    // Filter nulls and sort by last message timestamp (newest first)
    const sorted = conversations
      .filter(Boolean)
      .sort((a, b) => {
        const ta = a.last_message?.created_at || a.created_at;
        const tb = b.last_message?.created_at || b.created_at;
        return new Date(tb) - new Date(ta);
      });

    return res.json({ conversations: sorted });
  } catch (err) {
    console.error("[ListConversations]", err.message);
    return res.status(500).json({ error: "Failed to fetch conversations." });
  }
}

// ── POST /api/messages/conversations ─────────────────────────────────────
// Body: { other_user_id, property_id? }
// Gets existing conversation or creates a new one.
async function getOrCreateConversation(req, res) {
  try {
    const { other_user_id, property_id = null } = req.body;
    const userId = req.user.id;

    if (!other_user_id) {
      return res.status(400).json({ error: "other_user_id is required." });
    }
    if (other_user_id === userId) {
      return res.status(400).json({ error: "Cannot start a conversation with yourself." });
    }

    // Check the other user exists
    const other = await get("SELECT id FROM users WHERE id = ?", [other_user_id]);
    if (!other) return res.status(404).json({ error: "User not found." });

    // Look for an existing conversation between these two users for this property
    const existing = await get(
      `SELECT cp1.conversation_id
       FROM conversation_participants cp1
       JOIN conversation_participants cp2
         ON cp1.conversation_id = cp2.conversation_id
       JOIN conversations c
         ON c.id = cp1.conversation_id
       WHERE cp1.user_id = ?
         AND cp2.user_id = ?
         AND (c.property_id = ? OR (c.property_id IS NULL AND ? IS NULL))
       LIMIT 1`,
      [userId, other_user_id, property_id, property_id]
    );

    if (existing) {
      const conv = await buildConversation(existing.conversation_id, userId);
      return res.json({ conversation: conv, created: false });
    }

    // Create new conversation
    const convId = uuidv4();
    await run(
      "INSERT INTO conversations (id, property_id) VALUES (?, ?)",
      [convId, property_id]
    );
    await run(
      "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)",
      [convId, userId, convId, other_user_id]
    );

    const conv = await buildConversation(convId, userId);
    return res.status(201).json({ conversation: conv, created: true });
  } catch (err) {
    console.error("[GetOrCreateConversation]", err.message);
    return res.status(500).json({ error: "Failed to create conversation." });
  }
}

// ── GET /api/messages/conversations/:id ──────────────────────────────────
async function getConversation(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify participation
    const participant = await get(
      "SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
      [id, userId]
    );
    if (!participant) return res.status(403).json({ error: "Access denied." });

    const conv = await buildConversation(id, userId);
    if (!conv) return res.status(404).json({ error: "Conversation not found." });

    return res.json({ conversation: conv });
  } catch (err) {
    console.error("[GetConversation]", err.message);
    return res.status(500).json({ error: "Failed to fetch conversation." });
  }
}

// ── GET /api/messages/conversations/:id/messages ─────────────────────────
async function listMessages(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify participation
    const participant = await get(
      "SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
      [id, userId]
    );
    if (!participant) return res.status(403).json({ error: "Access denied." });

    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const [countRow] = await all(
      "SELECT COUNT(*) AS total FROM messages WHERE conversation_id = ?",
      [id]
    );

    const rows = await all(
      `SELECT m.id, m.sender_id, m.body, m.is_read, m.created_at,
              u.name AS sender_name, u.profile_image AS sender_image
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );

    // Auto-mark incoming messages as read when fetched
    await run(
      "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0",
      [id, userId]
    );

    return res.json({
      messages: rows.map(m => ({ ...m, created_at: isoDate(m.created_at) })),
      pagination: {
        total: countRow?.total || 0,
        page, limit,
        pages: Math.ceil((countRow?.total || 0) / limit)
      }
    });
  } catch (err) {
    console.error("[ListMessages]", err.message);
    return res.status(500).json({ error: "Failed to fetch messages." });
  }
}

// ── POST /api/messages/conversations/:id/messages ────────────────────────
async function sendMessage(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: "Message body cannot be empty." });
    }

    // Verify participation
    const participant = await get(
      "SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
      [id, userId]
    );
    if (!participant) return res.status(403).json({ error: "Access denied." });

    const msgId = uuidv4();
    await run(
      "INSERT INTO messages (id, conversation_id, sender_id, body, is_read) VALUES (?, ?, ?, ?, 0)",
      [msgId, id, userId, body.trim()]
    );

    const msg = await get(
      `SELECT m.id, m.sender_id, m.body, m.is_read, m.created_at,
              u.name AS sender_name, u.profile_image AS sender_image
       FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [msgId]
    );

    // Notify the other participant(s) — non-fatal
    try {
      const otherParticipants = await all(
        "SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?",
        [id, userId]
      );
      for (const p of otherParticipants) {
        await createNotification(
          p.user_id,
          "New Message",
          `${req.user.name} sent you a message.`,
          "message",
          id
        );
      }
    } catch (_) { /* non-fatal */ }

    return res.status(201).json({
      message: { ...msg, created_at: isoDate(msg.created_at) }
    });
  } catch (err) {
    console.error("[SendMessage]", err.message);
    return res.status(500).json({ error: "Failed to send message." });
  }
}

// ── PATCH /api/messages/conversations/:id/read ───────────────────────────
async function markConversationRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const participant = await get(
      "SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
      [id, userId]
    );
    if (!participant) return res.status(403).json({ error: "Access denied." });

    await run(
      "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0",
      [id, userId]
    );

    return res.json({ message: "Conversation marked as read." });
  } catch (err) {
    console.error("[MarkConversationRead]", err.message);
    return res.status(500).json({ error: "Failed to mark conversation as read." });
  }
}

// ── GET /api/messages/unread-count ───────────────────────────────────────
async function getUnreadCount(req, res) {
  try {
    const userId = req.user.id;

    const row = await get(
      `SELECT COUNT(*) AS cnt
       FROM messages m
       JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
       WHERE cp.user_id = ? AND m.sender_id != ? AND m.is_read = 0`,
      [userId, userId]
    );

    return res.json({ unread_count: row?.cnt || 0 });
  } catch (err) {
    console.error("[getUnreadCount]", err.message);
    return res.status(500).json({ error: "Failed to fetch unread count." });
  }
}

// ── POST /api/messages/support ───────────────────────────────────────────
// Allows any authenticated client to get or create a direct conversation with the main administrator.
async function contactAdminSupport(req, res) {
  try {
    const userId = req.user.id;

    // Find the primary admin
    const admin = await get(
      "SELECT id, name, email, profile_image, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
    );
    if (!admin) {
      return res.status(404).json({ error: "System administrator account not found." });
    }

    if (admin.id === userId) {
      return res.status(400).json({ error: "You are currently logged in as administrator." });
    }

    // Look for an existing direct conversation between user and admin (property_id IS NULL)
    const existing = await get(
      `SELECT cp1.conversation_id
       FROM conversation_participants cp1
       JOIN conversation_participants cp2
         ON cp1.conversation_id = cp2.conversation_id
       JOIN conversations c
         ON c.id = cp1.conversation_id
       WHERE cp1.user_id = ?
         AND cp2.user_id = ?
         AND c.property_id IS NULL
       LIMIT 1`,
      [userId, admin.id]
    );

    if (existing) {
      const conv = await buildConversation(existing.conversation_id, userId);
      return res.json({ conversation: conv, admin, created: false });
    }

    // Create new conversation
    const convId = uuidv4();
    await run("INSERT INTO conversations (id, property_id) VALUES (?, NULL)", [convId]);
    await run(
      "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)",
      [convId, userId, convId, admin.id]
    );

    const conv = await buildConversation(convId, userId);
    return res.status(201).json({ conversation: conv, admin, created: true });
  } catch (err) {
    console.error("[ContactAdminSupport]", err.message);
    return res.status(500).json({ error: "Failed to connect with administrator." });
  }
}

module.exports = {
  listConversations,
  getOrCreateConversation,
  getConversation,
  listMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
  contactAdminSupport,
};

