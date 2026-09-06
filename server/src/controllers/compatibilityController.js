/**
 * compatibilityController.js — Compatibility score persistence.
 *
 * POST /api/compatibility/save   — Save a batch of computed scores for the current user
 * GET  /api/compatibility        — Retrieve stored scores for the current user
 */
const { run, all } = require("../database/db");

// ── POST /api/compatibility/save ─────────────────────────────────────────
async function saveScores(req, res) {
  try {
    const userId = req.user.id;
    const { scores } = req.body;

    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: "scores array is required." });
    }

    for (const s of scores) {
      const { candidate_id, score, budget_score, lifestyle_score, interests_score } = s;
      if (!candidate_id || score === undefined) continue;

      await run(
        `INSERT OR REPLACE INTO compatibility_scores
           (user_id, candidate_id, score, budget_score, lifestyle_score, interests_score, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          userId,
          candidate_id,
          Math.round(score)          || 0,
          Math.round(budget_score)   || 0,
          Math.round(lifestyle_score)|| 0,
          Math.round(interests_score)|| 0,
        ]
      );
    }

    return res.json({ message: `${scores.length} scores saved.` });
  } catch (err) {
    console.error("[SaveScores]", err.message);
    return res.status(500).json({ error: "Failed to save compatibility scores." });
  }
}

// ── GET /api/compatibility ────────────────────────────────────────────────
async function getScores(req, res) {
  try {
    const userId = req.user.id;

    const rows = await all(
      `SELECT cs.candidate_id, cs.score, cs.budget_score, cs.lifestyle_score,
              cs.interests_score, cs.calculated_at,
              u.name AS candidate_name, u.profile_image AS candidate_image
       FROM compatibility_scores cs
       JOIN users u ON cs.candidate_id = u.id
       WHERE cs.user_id = ?
       ORDER BY cs.score DESC`,
      [userId]
    );

    return res.json({ scores: rows });
  } catch (err) {
    console.error("[GetScores]", err.message);
    return res.status(500).json({ error: "Failed to fetch compatibility scores." });
  }
}

module.exports = { saveScores, getScores };
