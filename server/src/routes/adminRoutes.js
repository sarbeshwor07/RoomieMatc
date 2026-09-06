/**
 * adminRoutes.js
 *
 * GET /api/admin/stats       Dashboard statistics
 * GET /api/admin/activity    Recent activity feed
 */
const express = require("express");
const router  = express.Router();
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { getStats, getActivity, broadcastAnnouncement } = require("../controllers/adminController");

router.get("/stats",       requireAuth, requireAdmin, getStats);
router.get("/activity",    requireAuth, requireAdmin, getActivity);
router.post("/broadcast",  requireAuth, requireAdmin, broadcastAnnouncement);

module.exports = router;
