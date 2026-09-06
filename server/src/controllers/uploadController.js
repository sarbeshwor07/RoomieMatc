/**
 * uploadController.js — Profile image, verification document, and property image handlers.
 *
 * MySQL migration changes from SQLite version:
 *  - datetime('now')       → NOW()
 *  - ON CONFLICT … DO UPDATE → INSERT … ON DUPLICATE KEY UPDATE
 *  - All db calls use the mysql2-backed helpers (run, get, all)
 *  - Dates returned as JS Date objects — converted to ISO strings where needed
 *
 * Security:
 *  - All routes require JWT authentication (applied in router)
 *  - Verification documents are served through an auth-gated endpoint only
 *  - Ownership is verified before any delete/update operation
 *  - Filenames are UUIDs — original filenames are never stored or exposed
 */
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { run, get, all } = require("../database/db");
const { UPLOAD_ROOT } = require("../middleware/upload");

// ── Internal helpers ───────────────────────────────────────────────────────

function fileUrl(subfolder, filename) {
  return `/api/uploads/${subfolder}/${filename}`;
}

function deleteFile(subfolder, filename) {
  if (!filename) return;
  try {
    const filePath = path.join(UPLOAD_ROOT, subfolder, path.basename(filename));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn("[DeleteFile] Could not delete:", e.message);
  }
}

function isoDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

// ── Profile Image ──────────────────────────────────────────────────────────

async function uploadProfileImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    const userId = req.user.id;

    // Remove previous profile image file if one exists
    const existing = await get("SELECT profile_image FROM users WHERE id = ?", [
      userId,
    ]);
    if (existing?.profile_image) {
      deleteFile("profiles", path.basename(existing.profile_image));
    }

    const imageUrl = fileUrl("profiles", req.file.filename);

    // MySQL: updated_at handled by ON UPDATE CURRENT_TIMESTAMP
    await run("UPDATE users SET profile_image = ? WHERE id = ?", [
      imageUrl,
      userId,
    ]);

    return res.json({
      imageUrl,
      message: "Profile image updated successfully.",
    });
  } catch (err) {
    console.error("[UploadProfileImage]", err.message);
    return res.status(500).json({ error: "Failed to upload profile image." });
  }
}

async function deleteProfileImage(req, res) {
  try {
    const userId = req.user.id;
    const existing = await get("SELECT profile_image FROM users WHERE id = ?", [
      userId,
    ]);

    if (existing?.profile_image) {
      deleteFile("profiles", path.basename(existing.profile_image));
      await run("UPDATE users SET profile_image = NULL WHERE id = ?", [userId]);
    }

    return res.json({ message: "Profile image removed." });
  } catch (err) {
    console.error("[DeleteProfileImage]", err.message);
    return res.status(500).json({ error: "Failed to remove profile image." });
  }
}

// ── Verification Documents ─────────────────────────────────────────────────

async function uploadVerificationDoc(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No document file provided." });
    }

    const userId = req.user.id;
    const docType = (req.body.document_type || "ID Document").trim();
    const docPath = fileUrl("verifications", req.file.filename);

    // Remove old document file if one exists
    const existing = await get(
      "SELECT document_path FROM verification_docs WHERE user_id = ?",
      [userId],
    );
    if (existing?.document_path) {
      deleteFile("verifications", path.basename(existing.document_path));
    }

    const id = uuidv4();

    await run(
      `INSERT INTO verification_docs (id, user_id, document_path, document_type, status, submitted_at)
       VALUES (?, ?, ?, ?, 'PENDING', datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         document_path    = excluded.document_path,
         document_type    = excluded.document_type,
         status           = 'PENDING',
         rejection_reason = NULL,
         submitted_at     = datetime('now'),
         reviewed_at      = NULL,
         reviewed_by      = NULL`,
      [id, userId, docPath, docType],
    );

    return res.status(201).json({
      message: "Verification document submitted. Pending admin review.",
      status: "PENDING",
    });
  } catch (err) {
    console.error("[UploadVerificationDoc]", err.message);
    return res
      .status(500)
      .json({ error: "Failed to upload verification document." });
  }
}

async function getMyVerificationStatus(req, res) {
  try {
    const userId = req.user.id;
    const doc = await get(
      `SELECT id, document_type, status, rejection_reason,
              submitted_at, reviewed_at
       FROM verification_docs WHERE user_id = ?`,
      [userId],
    );

    if (!doc) {
      return res.json({ status: "NOT_SUBMITTED" });
    }

    return res.json({
      ...doc,
      submitted_at: isoDate(doc.submitted_at),
      reviewed_at: isoDate(doc.reviewed_at),
    });
  } catch (err) {
    console.error("[GetMyVerificationStatus]", err.message);
    return res
      .status(500)
      .json({ error: "Failed to fetch verification status." });
  }
}

// ── Admin: serve verification document (auth-gated) ────────────────────────

async function serveVerificationDoc(req, res) {
  try {
    const { userId } = req.params;

    // Admins can view any; users can only view their own
    if (req.user.role !== "admin" && req.user.id !== userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    const doc = await get(
      "SELECT document_path FROM verification_docs WHERE user_id = ?",
      [userId],
    );
    if (!doc) {
      return res
        .status(404)
        .json({ error: "Verification document not found." });
    }

    const filename = path.basename(doc.document_path);
    const filePath = path.join(UPLOAD_ROOT, "verifications", filename);

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ error: "Document file not found on server." });
    }

    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(filePath);
  } catch (err) {
    console.error("[ServeVerificationDoc]", err.message);
    return res.status(500).json({ error: "Failed to serve document." });
  }
}

// ── Admin: approve verification ────────────────────────────────────────────

async function approveVerification(req, res) {
  try {
    const { userId } = req.params;

    // ── Pre-approval checks ───────────────────────────────────────────────
    const user = await get(
      "SELECT id, name, age, profile_image FROM users WHERE id = ?",
      [userId],
    );
    if (!user) return res.status(404).json({ error: "User not found." });

    // 1. Age must be provided and >= 18
    if (!user.age || user.age === 0) {
      return res.status(400).json({
        error:
          "Cannot verify: age is not set. User must provide their age before verification.",
      });
    }
    if (user.age < 18) {
      return res.status(400).json({
        error: `Cannot verify: user is ${user.age} years old. Users must be 18 or older to be verified.`,
      });
    }

    // 2. Profile image must be uploaded
    if (!user.profile_image) {
      return res.status(400).json({
        error:
          "Cannot verify: profile image is missing. User must upload a profile photo first.",
      });
    }

    // 3. Verification document must be submitted
    const doc = await get(
      "SELECT id FROM verification_docs WHERE user_id = ?",
      [userId],
    );
    if (!doc) {
      return res.status(400).json({
        error: "Cannot verify: no identity document has been submitted.",
      });
    }

    await run(
      `UPDATE verification_docs
       SET status = 'APPROVED', reviewed_at = NOW(), reviewed_by = ?, rejection_reason = NULL
       WHERE user_id = ?`,
      [req.user.id, userId],
    );

    await run("UPDATE users SET is_verified = 1 WHERE id = ?", [userId]);

    return res.json({ message: "User verification approved." });
  } catch (err) {
    console.error("[ApproveVerification]", err.message);
    return res.status(500).json({ error: "Failed to approve verification." });
  }
}

// ── Admin: reject verification ─────────────────────────────────────────────

async function rejectVerification(req, res) {
  try {
    const { userId } = req.params;
    const reason = (
      req.body.reason || "Document could not be verified."
    ).trim();

    const doc = await get(
      "SELECT id FROM verification_docs WHERE user_id = ?",
      [userId],
    );
    if (!doc) {
      return res
        .status(404)
        .json({ error: "No verification submission found." });
    }

    await run(
      `UPDATE verification_docs
       SET status = 'REJECTED', reviewed_at = NOW(), reviewed_by = ?, rejection_reason = ?
       WHERE user_id = ?`,
      [req.user.id, reason, userId],
    );

    await run("UPDATE users SET is_verified = 0 WHERE id = ?", [userId]);

    return res.json({ message: "User verification rejected." });
  } catch (err) {
    console.error("[RejectVerification]", err.message);
    return res.status(500).json({ error: "Failed to reject verification." });
  }
}

// ── Admin: list all pending verifications ─────────────────────────────────

async function listPendingVerifications(req, res) {
  try {
    const rows = await all(
      `SELECT vd.id, vd.user_id, vd.document_type, vd.status,
              vd.submitted_at, vd.reviewed_at, vd.rejection_reason,
              u.name, u.email, u.role
       FROM verification_docs vd
       JOIN users u ON vd.user_id = u.id
       WHERE vd.status = 'PENDING'
       ORDER BY vd.submitted_at ASC`,
    );

    return res.json({
      verifications: rows.map((r) => ({
        ...r,
        submitted_at: isoDate(r.submitted_at),
        reviewed_at: isoDate(r.reviewed_at),
      })),
    });
  } catch (err) {
    console.error("[ListPendingVerifications]", err.message);
    return res.status(500).json({ error: "Failed to fetch verifications." });
  }
}

// ── Property Images ────────────────────────────────────────────────────────

async function uploadPropertyImages(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No image files provided." });
    }

    const { propertyId } = req.params;

    // Verify property exists and requester is the owner (or admin)
    const property = await get(
      "SELECT id, owner_id FROM properties WHERE id = ?",
      [propertyId],
    );
    if (!property) {
      return res.status(404).json({ error: "Property not found." });
    }
    if (property.owner_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied." });
    }

    // Check current image count against limit
    const [countRow] = await all(
      "SELECT COUNT(*) AS cnt FROM property_images WHERE property_id = ?",
      [propertyId],
    );
    const currentCount = countRow?.cnt || 0;
    const maxImages = Number(process.env.MAX_PROPERTY_IMAGES) || 6;

    if (currentCount + req.files.length > maxImages) {
      req.files.forEach((f) => deleteFile("properties", f.filename));
      return res.status(400).json({
        error: `You can upload up to ${maxImages} property images.`,
      });
    }

    const isFirstUpload = currentCount === 0;
    const savedImages = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const imageUrl = fileUrl("properties", file.filename);
      const isPrimary = isFirstUpload && i === 0 ? 1 : 0;
      const imgId = uuidv4();

      await run(
        `INSERT INTO property_images (id, property_id, image_path, is_primary, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [imgId, propertyId, imageUrl, isPrimary, currentCount + i],
      );

      savedImages.push({
        id: imgId,
        image_path: imageUrl,
        is_primary: isPrimary,
      });
    }

    return res.status(201).json({ images: savedImages });
  } catch (err) {
    console.error("[UploadPropertyImages]", err.message);
    return res.status(500).json({ error: "Failed to upload property images." });
  }
}

async function getPropertyImages(req, res) {
  try {
    const { propertyId } = req.params;
    const images = await all(
      `SELECT id, image_path, is_primary, sort_order, created_at
       FROM property_images
       WHERE property_id = ?
       ORDER BY is_primary DESC, sort_order ASC, created_at ASC`,
      [propertyId],
    );
    return res.json({
      images: images.map((img) => ({
        ...img,
        created_at: isoDate(img.created_at),
      })),
    });
  } catch (err) {
    console.error("[GetPropertyImages]", err.message);
    return res.status(500).json({ error: "Failed to fetch property images." });
  }
}

async function deletePropertyImage(req, res) {
  try {
    const { imageId } = req.params;

    const img = await get(
      `SELECT pi.id, pi.image_path, pi.is_primary, pi.property_id, p.owner_id
       FROM property_images pi
       JOIN properties p ON pi.property_id = p.id
       WHERE pi.id = ?`,
      [imageId],
    );
    if (!img) {
      return res.status(404).json({ error: "Image not found." });
    }
    if (img.owner_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied." });
    }

    deleteFile("properties", path.basename(img.image_path));
    await run("DELETE FROM property_images WHERE id = ?", [imageId]);

    // If the deleted image was primary, promote the next image
    if (img.is_primary) {
      const next = await get(
        `SELECT id FROM property_images
         WHERE property_id = ?
         ORDER BY sort_order ASC, created_at ASC
         LIMIT 1`,
        [img.property_id],
      );
      if (next) {
        await run("UPDATE property_images SET is_primary = 1 WHERE id = ?", [
          next.id,
        ]);
      }
    }

    return res.json({ message: "Image deleted." });
  } catch (err) {
    console.error("[DeletePropertyImage]", err.message);
    return res.status(500).json({ error: "Failed to delete image." });
  }
}

async function setPrimaryImage(req, res) {
  try {
    const { imageId } = req.params;

    const img = await get(
      `SELECT pi.id, pi.property_id, p.owner_id
       FROM property_images pi
       JOIN properties p ON pi.property_id = p.id
       WHERE pi.id = ?`,
      [imageId],
    );
    if (!img) {
      return res.status(404).json({ error: "Image not found." });
    }
    if (img.owner_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied." });
    }

    // Clear all primary flags for this property then set the selected one
    await run(
      "UPDATE property_images SET is_primary = 0 WHERE property_id = ?",
      [img.property_id],
    );
    await run("UPDATE property_images SET is_primary = 1 WHERE id = ?", [
      imageId,
    ]);

    return res.json({ message: "Primary image updated." });
  } catch (err) {
    console.error("[SetPrimaryImage]", err.message);
    return res.status(500).json({ error: "Failed to set primary image." });
  }
}

// ── Static file serving (profiles + properties only) ──────────────────────
// Verification docs go through serveVerificationDoc (auth-gated above).

function serveStaticUpload(req, res) {
  const { subfolder, filename } = req.params;

  if (subfolder === "verifications") {
    return res.status(403).json({ error: "Access denied." });
  }

  // Prevent path traversal
  const safe = path.basename(filename);
  const filePath = path.join(UPLOAD_ROOT, subfolder, safe);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found." });
  }

  res.sendFile(filePath);
}

// ── Admin: list ALL verifications (all statuses) ───────────────────────────
async function listAllVerifications(req, res) {
  try {
    const statusFilter = req.query.status || null;
    const params = [];
    let where = "";
    if (statusFilter) {
      where = "WHERE vd.status = ?";
      params.push(statusFilter);
    }

    const rows = await all(
      `SELECT vd.id, vd.user_id, vd.document_type, vd.status,
              vd.submitted_at, vd.reviewed_at, vd.rejection_reason,
              u.name, u.email, u.role, u.is_verified
       FROM verification_docs vd
       JOIN users u ON vd.user_id = u.id
       ${where}
       ORDER BY vd.submitted_at DESC`,
      params,
    );

    return res.json({
      verifications: rows.map((r) => ({
        ...r,
        submitted_at: isoDate(r.submitted_at),
        reviewed_at: isoDate(r.reviewed_at),
      })),
    });
  } catch (err) {
    console.error("[ListAllVerifications]", err.message);
    return res.status(500).json({ error: "Failed to fetch verifications." });
  }
}

// ── Admin: revoke a previously approved verification ──────────────────────
async function unverifyUser(req, res) {
  try {
    const { userId } = req.params;
    const reason = (
      req.body.reason || "Verification revoked by administrator."
    ).trim();

    const doc = await get(
      "SELECT id FROM verification_docs WHERE user_id = ?",
      [userId],
    );
    if (!doc)
      return res
        .status(404)
        .json({ error: "No verification submission found." });

    await run(
      `UPDATE verification_docs
       SET status = 'REJECTED', reviewed_at = NOW(), reviewed_by = ?, rejection_reason = ?
       WHERE user_id = ?`,
      [req.user.id, reason, userId],
    );
    await run("UPDATE users SET is_verified = 0 WHERE id = ?", [userId]);

    return res.json({ message: "User verification revoked." });
  } catch (err) {
    console.error("[UnverifyUser]", err.message);
    return res.status(500).json({ error: "Failed to unverify user." });
  }
}

module.exports = {
  uploadProfileImage,
  deleteProfileImage,
  uploadVerificationDoc,
  getMyVerificationStatus,
  serveVerificationDoc,
  approveVerification,
  rejectVerification,
  listPendingVerifications,
  listAllVerifications,
  unverifyUser,
  uploadPropertyImages,
  getPropertyImages,
  deletePropertyImage,
  setPrimaryImage,
  serveStaticUpload,
};
