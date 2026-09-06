/**
 * migrate.js — Creates the RoomieMatch SQLite database schema.
 *
 * Run:  npm run db:migrate
 *
 * Safe to run multiple times — all statements use CREATE TABLE IF NOT EXISTS.
 */
const Database = require('better-sqlite3');
const path = require('path');

async function migrate() {
  const dbPath = path.resolve(__dirname, '../../data/roomiematch.db');
  console.log(`[Migrate] Opening SQLite database at ${dbPath}`);
  
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  
  console.log(`[Migrate] Creating tables...`);

  const tables = [
    // ── 1. users ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      email          TEXT NOT NULL UNIQUE,
      password_hash  TEXT NULL,
      role           TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
      google_id      TEXT NULL UNIQUE,
      profile_image  TEXT NULL,
      phone          TEXT NULL,
      university     TEXT NULL,
      major          TEXT NULL,
      age            INTEGER NULL,
      gender         TEXT NULL,
      city           TEXT NULL,
      budget_min     INTEGER NULL,
      budget_max     INTEGER NULL,
      bio            TEXT NULL,
      is_verified    INTEGER NOT NULL DEFAULT 0,
      is_blocked     INTEGER NOT NULL DEFAULT 0,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,

    // ── 2. user_preferences ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS user_preferences (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT NOT NULL UNIQUE,
      smoke          TEXT NOT NULL DEFAULT 'No',
      pet            TEXT NOT NULL DEFAULT 'No Pets',
      cleanliness    TEXT NOT NULL DEFAULT 'Medium',
      sleep_schedule TEXT NOT NULL DEFAULT 'Early Bird',
      social_life    TEXT NOT NULL DEFAULT 'Medium',
      cooking        TEXT NOT NULL DEFAULT 'Sometimes',
      drinking       TEXT NOT NULL DEFAULT 'No',
      guests         TEXT NOT NULL DEFAULT 'Occasionally',
      food           TEXT NOT NULL DEFAULT 'No Preference',
      working_hours  TEXT NOT NULL DEFAULT 'Regular Hours',
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // ── 3. user_hobbies ───────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS user_hobbies (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id  TEXT NOT NULL,
      hobby    TEXT NOT NULL,
      UNIQUE(user_id, hobby),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_hobbies_user ON user_hobbies(user_id)`,

    // ── 4. password_reset_tokens ──────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      token_hash  TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id)`,

    // ── 5. otp_verifications ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS otp_verifications (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NULL,
      email       TEXT NOT NULL,
      otp_hash    TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0,
      verified    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      verified_at TEXT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email)`,
    `CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_verifications(user_id)`,

    // ── 6. google_auth_pending ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS google_auth_pending (
      id             TEXT PRIMARY KEY,
      google_id      TEXT NOT NULL,
      email          TEXT NOT NULL,
      name           TEXT NULL,
      picture_url    TEXT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      expires_at     TEXT NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    `CREATE INDEX IF NOT EXISTS idx_gap_email ON google_auth_pending(email)`,
    `CREATE INDEX IF NOT EXISTS idx_gap_expires ON google_auth_pending(expires_at)`,

    // ── 7. verification_docs ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS verification_docs (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL UNIQUE,
      document_path    TEXT NOT NULL,
      document_type    TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
      rejection_reason TEXT NULL,
      submitted_at     TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at      TEXT NULL,
      reviewed_by      TEXT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_vdoc_status ON verification_docs(status)`,

    // ── 8. properties ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS properties (
      id             TEXT PRIMARY KEY,
      owner_id       TEXT NOT NULL,
      title          TEXT NOT NULL,
      address        TEXT NOT NULL,
      city           TEXT NOT NULL DEFAULT 'Metro City',
      latitude       REAL NULL,
      longitude      REAL NULL,
      type           TEXT NOT NULL DEFAULT 'Apartment' CHECK(type IN ('Apartment','Townhouse','Studio','House')),
      bedrooms       INTEGER NOT NULL DEFAULT 1,
      bathrooms      REAL NOT NULL DEFAULT 1.0,
      price          REAL NOT NULL,
      deposit        REAL NOT NULL DEFAULT 0.00,
      description    TEXT NULL,
      available_from TEXT NULL,
      status         TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','rented','inactive')),
      is_verified    INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_prop_owner ON properties(owner_id)`,
    `CREATE INDEX IF NOT EXISTS idx_prop_status ON properties(status)`,
    `CREATE INDEX IF NOT EXISTS idx_prop_city ON properties(city)`,
    `CREATE INDEX IF NOT EXISTS idx_prop_price ON properties(price)`,
    `CREATE INDEX IF NOT EXISTS idx_prop_verified ON properties(is_verified)`,

    // Continue with remaining tables...
    // ── 9. property_amenities ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS property_amenities (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id TEXT NOT NULL,
      amenity     TEXT NOT NULL,
      UNIQUE(property_id, amenity),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_amenity_prop ON property_amenities(property_id)`,

    // ── 10. property_rules ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS property_rules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id TEXT NOT NULL,
      rule        TEXT NOT NULL,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_rule_prop ON property_rules(property_id)`,

    // ── 11. property_images ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS property_images (
      id          TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      image_path  TEXT NOT NULL,
      is_primary  INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_img_prop ON property_images(property_id)`,

    // ── 12. applications ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS applications (
      id          TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      tenant_id   TEXT NOT NULL,
      owner_id    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
      message     TEXT NULL,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tenant_id, property_id),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_app_tenant ON applications(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_app_owner ON applications(owner_id)`,
    `CREATE INDEX IF NOT EXISTS idx_app_property ON applications(property_id)`,
    `CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status)`,

    // ── 13. application_history ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS application_history (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT NOT NULL,
      status         TEXT NOT NULL,
      label          TEXT NOT NULL,
      changed_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_history_app ON application_history(application_id)`,

    // ── 14. conversations ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS conversations (
      id          TEXT PRIMARY KEY,
      property_id TEXT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_conv_property ON conversations(property_id)`,

    // ── 15. conversation_participants ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS conversation_participants (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      UNIQUE(conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_cp_user ON conversation_participants(user_id)`,

    // ── 16. messages ──────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id       TEXT NOT NULL,
      body            TEXT NOT NULL,
      is_read         INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_msg_conversation ON messages(conversation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages(sender_id)`,
    `CREATE INDEX IF NOT EXISTS idx_msg_created ON messages(created_at)`,

    // ── 17. notifications ─────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS notifications (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      title        TEXT NOT NULL,
      message      TEXT NOT NULL,
      type         TEXT NOT NULL DEFAULT 'general' CHECK(type IN ('message','application','verification','general')),
      reference_id TEXT NULL,
      is_read      INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(user_id, is_read)`,
    `CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at)`,

    // ── 18. reviews ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS reviews (
      id               TEXT PRIMARY KEY,
      reviewer_id      TEXT NOT NULL,
      target_property  TEXT NULL,
      target_user      TEXT NULL,
      rating           REAL NOT NULL,
      comment          TEXT NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_property) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_rev_reviewer ON reviews(reviewer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_rev_target_prop ON reviews(target_property)`,
    `CREATE INDEX IF NOT EXISTS idx_rev_target_user ON reviews(target_user)`,

    // ── 19. reports ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS reports (
      id                    TEXT PRIMARY KEY,
      reporter_id           TEXT NOT NULL,
      reported_user_id      TEXT NULL,
      reported_property_id  TEXT NULL,
      title                 TEXT NOT NULL,
      reason                TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')),
      resolution            TEXT NULL,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at           TEXT NULL,
      resolved_by           TEXT NULL,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (reported_property_id) REFERENCES properties(id) ON DELETE SET NULL,
      FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_rep_status ON reports(status)`,
    `CREATE INDEX IF NOT EXISTS idx_rep_reporter ON reports(reporter_id)`,

    // ── 20. favourites ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS favourites (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      property_id TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, property_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_fav_user ON favourites(user_id)`,

    // ── 21. email_verification_tokens ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      token_hash  TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_evt_token ON email_verification_tokens(token_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_evt_user ON email_verification_tokens(user_id)`,

    // ── 22. compatibility_scores ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS compatibility_scores (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          TEXT NOT NULL,
      candidate_id     TEXT NOT NULL,
      score            INTEGER NOT NULL DEFAULT 0,
      budget_score     INTEGER NOT NULL DEFAULT 0,
      lifestyle_score  INTEGER NOT NULL DEFAULT 0,
      interests_score  INTEGER NOT NULL DEFAULT 0,
      calculated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, candidate_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS idx_cs_user ON compatibility_scores(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cs_score ON compatibility_scores(user_id, score DESC)`,
  ];

  let created = 0;
  for (const ddl of tables) {
    const tableName = (ddl.match(/CREATE (?:TABLE|INDEX) IF NOT EXISTS (\w+)/) || [])[1] || "?";
    try {
      db.exec(ddl);
      console.log(`  ✓ ${tableName}`);
      created++;
    } catch (err) {
      console.error(`  ✗ ${tableName}: ${err.message}`);
      throw err;
    }
  }

  console.log(`\n[Migrate] Done — ${created}/${tables.length} tables/indexes ready.\n`);
  db.close();
}

migrate().catch((err) => {
  console.error("\n[Migrate] FAILED:", err.message);
  console.error("Full error:", err);
  process.exit(1);
});
