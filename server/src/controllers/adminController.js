/**
 * adminController.js — Admin-only dashboard statistics and bulk operations.
 *
 * Endpoints:
 *   GET /api/admin/stats      Summary counts for the dashboard
 *   GET /api/admin/activity   Recent activity feed (latest users, properties, apps)
 */
const { v4: uuidv4 } = require("uuid");
const { all, get, run } = require("../database/db");

function isoDate(v) {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : v;
}

// ── GET /api/admin/stats ──────────────────────────────────────────────────
async function getStats(req, res) {
  try {
    // Run all count queries in parallel
    const [
      usersRow,
      tenantsRow,
      ownersRow,
      propertiesRow,
      activePropsRow,
      pendingVerifRow,
      pendingAppsRow,
      pendingReportsRow,
      messagesRow,
      revenueRow,
    ] = await Promise.all([
      get("SELECT COUNT(*) AS cnt FROM users WHERE role = 'user'"),
      get("SELECT COUNT(DISTINCT tenant_id) AS cnt FROM applications"),
      get("SELECT COUNT(DISTINCT owner_id) AS cnt FROM properties"),
      get("SELECT COUNT(*) AS cnt FROM properties"),
      get("SELECT COUNT(*) AS cnt FROM properties WHERE status = 'active' AND is_verified = 1"),
      get("SELECT COUNT(*) AS cnt FROM verification_docs WHERE status = 'PENDING'"),
      get("SELECT COUNT(*) AS cnt FROM applications WHERE status = 'pending'"),
      get("SELECT COUNT(*) AS cnt FROM reports WHERE status = 'pending'"),
      get("SELECT COUNT(*) AS cnt FROM messages"),
      get("SELECT COALESCE(SUM(price), 0) AS total FROM properties WHERE status = 'rented'"),
    ]);

    // Month-over-month new users (last 30 days vs 30-60 days ago)
    const newUsersThisMonth = await get(
      "SELECT COUNT(*) AS cnt FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );
    const newUsersLastMonth = await get(
      "SELECT COUNT(*) AS cnt FROM users WHERE created_at BETWEEN DATE_SUB(NOW(), INTERVAL 60 DAY) AND DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );

    // Properties added in last 30 days
    const newPropsThisMonth = await get(
      "SELECT COUNT(*) AS cnt FROM properties WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );

    // Approved applications this month
    const approvedThisMonth = await get(
      "SELECT COUNT(*) AS cnt FROM applications WHERE status = 'approved' AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );

    return res.json({
      users: {
        total:     usersRow?.cnt        || 0,
        tenants:   tenantsRow?.cnt      || 0,
        owners:    ownersRow?.cnt       || 0,
        newThisMonth: newUsersThisMonth?.cnt || 0,
        newLastMonth: newUsersLastMonth?.cnt || 0,
      },
      properties: {
        total:          propertiesRow?.cnt    || 0,
        active:         activePropsRow?.cnt   || 0,
        newThisMonth:   newPropsThisMonth?.cnt || 0,
      },
      applications: {
        pending:         pendingAppsRow?.cnt   || 0,
        approvedThisMonth: approvedThisMonth?.cnt || 0,
      },
      verifications: {
        pending: pendingVerifRow?.cnt || 0,
      },
      reports: {
        pending: pendingReportsRow?.cnt || 0,
      },
      messages: {
        total: messagesRow?.cnt || 0,
      },
      revenue: {
        totalRentedMonthly: parseFloat(revenueRow?.total) || 0,
      }
    });
  } catch (err) {
    console.error("[GetStats]", err.message);
    return res.status(500).json({ error: "Failed to fetch statistics." });
  }
}

// ── GET /api/admin/activity ───────────────────────────────────────────────
async function getActivity(req, res) {
  try {
    const limit = Math.min(20, parseInt(req.query.limit) || 10);

    const [recentUsers, recentProperties, recentApplications, recentReports] = await Promise.all([
      all(
        `SELECT id, name, email, role, created_at
         FROM users ORDER BY created_at DESC LIMIT ?`,
        [limit]
      ),
      all(
        `SELECT p.id, p.title, p.city, p.price, p.status, p.is_verified, p.created_at,
                u.name AS owner_name
         FROM properties p JOIN users u ON p.owner_id = u.id
         ORDER BY p.created_at DESC LIMIT ?`,
        [limit]
      ),
      all(
        `SELECT a.id, a.status, a.applied_at,
                p.title AS property_title,
                t.name  AS tenant_name
         FROM applications a
         JOIN properties p ON a.property_id = p.id
         JOIN users t      ON a.tenant_id   = t.id
         ORDER BY a.applied_at DESC LIMIT ?`,
        [limit]
      ),
      all(
        `SELECT r.id, r.title, r.status, r.created_at,
                u.name AS reporter_name
         FROM reports r JOIN users u ON r.reporter_id = u.id
         ORDER BY r.created_at DESC LIMIT ?`,
        [limit]
      ),
    ]);

    return res.json({
      recentUsers:        recentUsers.map(u => ({ ...u, created_at: isoDate(u.created_at) })),
      recentProperties:   recentProperties.map(p => ({ ...p, created_at: isoDate(p.created_at) })),
      recentApplications: recentApplications.map(a => ({ ...a, applied_at: isoDate(a.applied_at) })),
      recentReports:      recentReports.map(r => ({ ...r, created_at: isoDate(r.created_at) })),
    });
  } catch (err) {
    console.error("[GetActivity]", err.message);
    return res.status(500).json({ error: "Failed to fetch activity." });
  }
}

// ── POST /api/admin/broadcast ─────────────────────────────────────────────
// Admin sends an announcement / broadcast to all or targeted clients
async function broadcastAnnouncement(req, res) {
  try {
    const adminId = req.user.id;
    const {
      title,
      message,
      target = "all", // "all" | "tenants" | "owners"
      sendNotification = true,
      sendChatMessage = true,
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Broadcast message text is required." });
    }

    const broadcastTitle = (title || "RoomieMatch Announcement").trim();
    const broadcastBody = message.trim();

    // Determine target users (excluding the admin themselves)
    let query = "SELECT id, name, email FROM users WHERE role != 'admin' AND is_blocked = 0";
    if (target === "owners" || target === "landlord") {
      query = `SELECT DISTINCT u.id, u.name, u.email
               FROM users u
               JOIN properties p ON p.owner_id = u.id
               WHERE u.role != 'admin' AND u.is_blocked = 0`;
    } else if (target === "tenants" || target === "user") {
      query = `SELECT u.id, u.name, u.email
               FROM users u
               WHERE u.role != 'admin' AND u.is_blocked = 0
                 AND u.id NOT IN (SELECT DISTINCT owner_id FROM properties)`;
    }

    const recipients = await all(query);
    if (recipients.length === 0) {
      return res.json({ message: "No recipients found for this target audience.", count: 0 });
    }

    const io = req.app.get("io");

    // Process delivery
    let notifCount = 0;
    let chatCount = 0;

    for (const recipient of recipients) {
      try {
        // 1. In-app Notification
        if (sendNotification) {
          const notifId = uuidv4();
          await run(
            `INSERT INTO notifications (id, user_id, title, message, type, reference_id, is_read)
             VALUES (?, ?, ?, ?, 'general', NULL, 0)`,
            [notifId, recipient.id, broadcastTitle, broadcastBody]
          );
          notifCount++;

          // Push real-time notification via Socket.io to user room
          if (io) {
            io.to(recipient.id).emit("new_notification", {
              id: notifId,
              title: broadcastTitle,
              message: broadcastBody,
              type: "general",
              is_read: 0,
              created_at: new Date().toISOString(),
            });
            io.to(`user_${recipient.id}`).emit("new_notification", {
              id: notifId,
              title: broadcastTitle,
              message: broadcastBody,
              type: "general",
              is_read: 0,
              created_at: new Date().toISOString(),
            });
          }
        }

        // 2. Direct Chat Message from Admin
        if (sendChatMessage) {
          // Find existing conversation between admin and this user (with property_id IS NULL)
          let conv = await get(
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
            [adminId, recipient.id]
          );

          let convId = conv?.conversation_id;
          if (!convId) {
            convId = uuidv4();
            await run("INSERT INTO conversations (id, property_id) VALUES (?, NULL)", [convId]);
            await run(
              "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)",
              [convId, adminId, convId, recipient.id]
            );
          }

          const msgId = uuidv4();
          const fullChatText = title ? `📢 [${broadcastTitle}]\n${broadcastBody}` : `📢 ${broadcastBody}`;
          await run(
            `INSERT INTO messages (id, conversation_id, sender_id, body, is_read)
             VALUES (?, ?, ?, ?, 0)`,
            [msgId, convId, adminId, fullChatText]
          );
          chatCount++;

          // Push real-time message via Socket.io
          if (io) {
            const msgPayload = {
              id: msgId,
              conversation_id: convId,
              sender_id: adminId,
              body: fullChatText,
              is_read: 0,
              created_at: new Date().toISOString(),
              sender_name: req.user.name || "Administrator",
              sender_image: req.user.profile_image || null,
            };
            // Broadcast in both conversation room and direct user rooms
            io.to(convId).emit("new_message", { message: msgPayload });
            io.to(recipient.id).emit("new_message", { message: msgPayload });
            io.to(`user_${recipient.id}`).emit("new_message", { message: msgPayload });
          }
        }
      } catch (userErr) {
        console.error(`[BroadcastAnnouncement] Failed for user ${recipient.id}:`, userErr.message);
      }
    }

    return res.json({
      success: true,
      message: `Broadcast successfully sent to ${recipients.length} recipients.`,
      recipientsCount: recipients.length,
      notificationsSent: notifCount,
      chatMessagesSent: chatCount,
    });
  } catch (err) {
    console.error("[BroadcastAnnouncement]", err.message);
    return res.status(500).json({ error: err.message || "Failed to send broadcast announcement." });
  }
}

module.exports = { getStats, getActivity, broadcastAnnouncement };
