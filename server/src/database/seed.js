/**
 * seed.js — Populates the RoomieMatch SQLite database with demo data.
 *
 * Run:  npm run db:seed
 *
 * Safe to re-run — replaces or ignores existing rows cleanly.
 *
 * All users share the same unified 'user' role — every account can both
 * search/apply for properties AND list/manage their own properties.
 *
 * Demo accounts (password: password123):
 *   admin@roomiematch.com  → Admin panel
 *   alex@user.com          → Regular user
 *   sarah@user.com         → Regular user (has listed properties)
 *   marcus@user.com        → Regular user
 *   chloe@user.com         → Regular user (unverified)
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

async function hash(plain) {
  return bcrypt.hash(plain, 10);
}

// Fixed UUIDs so re-runs are idempotent
const ID = {
  admin:   "00000000-0000-0000-0000-000000000001",
  alex:    "00000000-0000-0000-0000-000000000002",
  sarah:   "00000000-0000-0000-0000-000000000003",
  marcus:  "00000000-0000-0000-0000-000000000004",
  chloe:   "00000000-0000-0000-0000-000000000005",
  prop1:   "00000000-0000-0000-1000-000000000001",
  prop2:   "00000000-0000-0000-1000-000000000002",
  prop3:   "00000000-0000-0000-1000-000000000003",
  prop4:   "00000000-0000-0000-1000-000000000004",
  app1:    "00000000-0000-0000-2000-000000000001",
  app2:    "00000000-0000-0000-2000-000000000002",
};

async function seed() {
  const dbPath = path.resolve(__dirname, "../../data/roomiematch.db");
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`[Seed] Connecting to SQLite database at ${dbPath}...`);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  console.log("[Seed] SQLite database opened.\n");

  // ── 1. Users ──────────────────────────────────────────────────────────────
  console.log("[Seed] Inserting users...");
  const pw = await hash("password123");

  const users = [
    // id, name, email, password_hash, role, phone, university, major, age, gender, city, budget_min, budget_max, bio, is_verified, email_verified
    [
      ID.admin, "Admin", "admin@roomiematch.com", pw,
      "admin", "+977 985-123-4567",
      null, null, null, null, "Kathmandu", null, null,
      "Platform administrator.",
      1, 1
    ],
    [
      ID.alex, "Alex Mercer", "alex@user.com", pw,
      "user", "+977 981-234-5678",
      "Tribhuvan University", "Computer Science", 21, "Male", "Kathmandu", 10000, 15000,
      "CS junior looking for a quiet study space and a friendly roommate. I enjoy hiking, coding side projects, and cooking.",
      1, 1
    ],
    [
      ID.sarah, "Sarah Jenkins", "sarah@user.com", pw,
      "user", "+977 984-567-8901",
      "Kathmandu University", "Business Management", 28, "Female", "Kathmandu", 12000, 20000,
      "Experienced with property management and happy to help students find great housing near campus.",
      1, 1
    ],
    [
      ID.marcus, "Marcus Brody", "marcus@user.com", pw,
      "user", "+977 986-789-0123",
      "Tribhuvan University", "Business Administration", 22, "Male", "Kathmandu", 11000, 17000,
      "Outgoing senior in business. Very active, loves soccer, and is looking for a roommate who doesn't mind occasional study groups.",
      1, 1
    ],
    [
      ID.chloe, "Chloe Henderson", "chloe@user.com", pw,
      "user", "+977 983-456-7890",
      "Tribhuvan University", "Graphic Design", 20, "Female", "Kathmandu", 9000, 14000,
      "Sophomore doing graphic design. I keep my space very clean and decorated. Love indoor plants, cafe hopping, and indie music.",
      0, 1
    ],
  ];

  const userStmt = db.prepare(`
    INSERT INTO users
      (id, name, email, password_hash, role, phone,
       university, major, age, gender, city, budget_min, budget_max, bio,
       is_verified, email_verified)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, email=excluded.email, password_hash=excluded.password_hash,
      city=excluded.city, is_verified=excluded.is_verified, email_verified=excluded.email_verified
  `);

  for (const u of users) {
    userStmt.run(...u);
  }
  console.log(`  ✓ ${users.length} users`);

  // ── 2. User preferences ───────────────────────────────────────────────────
  console.log("[Seed] Inserting user preferences...");
  const prefs = [
    // user_id, smoke, pet, cleanliness, sleep_schedule, social_life, cooking
    [ID.admin,  "No", "No Pets",            "Medium", "Early Bird", "Medium",   "Sometimes"],
    [ID.alex,   "No", "No Pets",            "High",   "Night Owl",  "Medium",   "Often"],
    [ID.sarah,  "No", "Pets Allowed",       "High",   "Early Bird", "Medium",   "Sometimes"],
    [ID.marcus, "No", "Pets Allowed",       "Medium", "Early Bird", "High",     "Sometimes"],
    [ID.chloe,  "No", "Dog or Cat Allowed", "High",   "Night Owl",  "High",     "Often"],
  ];

  const prefStmt = db.prepare(`
    INSERT INTO user_preferences (user_id, smoke, pet, cleanliness, sleep_schedule, social_life, cooking)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET smoke=excluded.smoke, cleanliness=excluded.cleanliness
  `);
  for (const p of prefs) {
    prefStmt.run(...p);
  }
  console.log(`  ✓ ${prefs.length} preference rows`);

  // ── 3. User hobbies ───────────────────────────────────────────────────────
  console.log("[Seed] Inserting hobbies...");
  const hobbies = [
    [ID.alex,   "Coding"],
    [ID.alex,   "Hiking"],
    [ID.alex,   "Cooking"],
    [ID.alex,   "Board Games"],
    [ID.sarah,  "Real Estate"],
    [ID.sarah,  "Gardening"],
    [ID.sarah,  "Cooking"],
    [ID.marcus, "Soccer"],
    [ID.marcus, "Netflix"],
    [ID.marcus, "Cooking"],
    [ID.marcus, "Photography"],
    [ID.chloe,  "Painting"],
    [ID.chloe,  "Indoor Plants"],
    [ID.chloe,  "Indie Music"],
    [ID.chloe,  "Thrifting"],
  ];

  const hobbyStmt = db.prepare("INSERT OR IGNORE INTO user_hobbies (user_id, hobby) VALUES (?,?)");
  for (const h of hobbies) {
    hobbyStmt.run(...h);
  }
  console.log(`  ✓ ${hobbies.length} hobby rows`);

  // ── 4. Verification docs ──────────────────────────────────────────────────
  console.log("[Seed] Inserting verification docs...");
  const vdocs = [
    // id, user_id, document_path, document_type, status, reviewed_by
    [uuidv4(), ID.alex,   "/api/uploads/verifications/demo-alex.pdf",   "ID Document", "APPROVED", ID.admin],
    [uuidv4(), ID.sarah,  "/api/uploads/verifications/demo-sarah.pdf",  "ID Document", "APPROVED", ID.admin],
    [uuidv4(), ID.marcus, "/api/uploads/verifications/demo-marcus.pdf", "ID Document", "APPROVED", ID.admin],
    [uuidv4(), ID.chloe,  "/api/uploads/verifications/demo-chloe.pdf",  "ID Document", "PENDING",  null],
  ];

  const vdocStmt = db.prepare(`
    INSERT INTO verification_docs
      (id, user_id, document_path, document_type, status, submitted_at, reviewed_at, reviewed_by)
    VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET status=excluded.status
  `);
  for (const d of vdocs) {
    vdocStmt.run(d[0], d[1], d[2], d[3], d[4], d[5] ? new Date().toISOString() : null, d[5]);
  }
  console.log(`  ✓ ${vdocs.length} verification doc rows`);

  // ── 5. Properties ─────────────────────────────────────────────────────────
  console.log("[Seed] Inserting properties...");
  const properties = [
    // id, owner_id, title, address, city, latitude, longitude, type, bedrooms, bathrooms, price, deposit, description, available_from, status, is_verified
    [
      ID.prop1, ID.sarah,
      "University Gardens Apartment",
      "104 University Ave, Suite 3B",
      "Kathmandu", 27.6820, 85.2830, "Apartment", 2, 2.0, 12500, 12500,
      "Spacious 2-bedroom apartment just a short 5-minute walk to the main gates of Tribhuvan University. Fully furnished kitchen, central heating, high-speed fiber internet, and on-site laundry facilities. Quiet building perfect for studious tenants.",
      "2026-09-01", "active", 1
    ],
    [
      ID.prop2, ID.sarah,
      "Modern Townhouse with Backyard",
      "452 Thamel Street",
      "Kathmandu", 27.7150, 85.3120, "Townhouse", 3, 2.5, 16500, 16500,
      "Beautiful 3-bedroom, 2.5-bathroom townhouse with a modern open-concept kitchen, hardwood floors, and a lovely fenced backyard. Private parking included. Utilities (water/gas) are partially included in rent.",
      "2026-09-15", "active", 1
    ],
    [
      ID.prop3, ID.sarah,
      "Cozy Studio near Library",
      "88 College Road, Apt 1A",
      "Kathmandu", 27.6950, 85.3200, "Studio", 1, 1.0, 9900, 9900,
      "Cozy studio apartment situated right next to the campus library and student union center. Features a kitchenette, modern bathroom, and pull-down Murphy bed. Ideal for single graduate students or busy juniors.",
      "2026-10-01", "active", 1
    ],
    [
      ID.prop4, ID.sarah,
      "Sunny 4-Bed Student House",
      "17 Baneshwor Lane",
      "Kathmandu", 27.6900, 85.3350, "House", 4, 2.0, 23750, 23750,
      "Bright 4-bedroom house perfect for a group of students. Large communal kitchen and lounge, two bathrooms, private garden, and street parking. A 10-minute bus ride to the university main campus.",
      "2026-09-01", "active", 1
    ],
  ];

  const propStmt = db.prepare(`
    INSERT INTO properties
      (id, owner_id, title, address, city, latitude, longitude, type, bedrooms, bathrooms,
       price, deposit, description, available_from, status, is_verified)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, price=excluded.price, latitude=excluded.latitude, longitude=excluded.longitude
  `);
  for (const p of properties) {
    propStmt.run(...p);
  }
  console.log(`  ✓ ${properties.length} properties`);

  // ── 6. Property images ───────────────────────────────────────────────────
  console.log("[Seed] Inserting property images...");
  const propImages = [
    [uuidv4(), ID.prop1, "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800", 1, 0],
    [uuidv4(), ID.prop1, "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", 0, 1],
    [uuidv4(), ID.prop2, "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800", 1, 0],
    [uuidv4(), ID.prop2, "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800", 0, 1],
    [uuidv4(), ID.prop3, "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800", 1, 0],
    [uuidv4(), ID.prop4, "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800", 1, 0],
  ];
  const imgStmt = db.prepare(`
    INSERT OR REPLACE INTO property_images (id, property_id, image_path, is_primary, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const img of propImages) {
    imgStmt.run(...img);
  }
  console.log(`  ✓ ${propImages.length} property images`);

  // ── 7. Property amenities ─────────────────────────────────────────────────
  console.log("[Seed] Inserting amenities...");
  const amenities = [
    [ID.prop1, "Wifi"],
    [ID.prop1, "Air Conditioning"],
    [ID.prop1, "On-site Laundry"],
    [ID.prop1, "Parking Spot"],
    [ID.prop1, "Fully Furnished"],
    [ID.prop1, "Dishwasher"],
    [ID.prop2, "Wifi"],
    [ID.prop2, "Air Conditioning"],
    [ID.prop2, "In-unit Laundry"],
    [ID.prop2, "Private Backyard"],
    [ID.prop2, "Garage Parking"],
    [ID.prop2, "Dishwasher"],
    [ID.prop3, "Wifi"],
    [ID.prop3, "Heating"],
    [ID.prop3, "On-site Laundry"],
    [ID.prop3, "Security Access"],
    [ID.prop4, "Wifi"],
    [ID.prop4, "Garden"],
    [ID.prop4, "Street Parking"],
    [ID.prop4, "Near Bus Stop"],
    [ID.prop4, "Large Kitchen"],
  ];
  const amenityStmt = db.prepare("INSERT OR IGNORE INTO property_amenities (property_id, amenity) VALUES (?,?)");
  for (const a of amenities) {
    amenityStmt.run(...a);
  }
  console.log(`  ✓ ${amenities.length} amenity rows`);

  // ── 8. Property rules ─────────────────────────────────────────────────────
  console.log("[Seed] Inserting rules...");
  const rules = [
    [ID.prop1, "No smoking"],
    [ID.prop1, "No loud parties after 10 PM"],
    [ID.prop1, "Cats allowed"],
    [ID.prop2, "No smoking"],
    [ID.prop2, "No pets"],
    [ID.prop2, "Quiet hours from 11 PM"],
    [ID.prop3, "No smoking"],
    [ID.prop3, "Pets allowed with deposit"],
    [ID.prop4, "No smoking indoors"],
    [ID.prop4, "Bills split equally"],
    [ID.prop4, "Shared cleaning rota"],
  ];
  const ruleStmt = db.prepare("INSERT OR IGNORE INTO property_rules (property_id, rule) VALUES (?,?)");
  for (const r of rules) {
    ruleStmt.run(...r);
  }
  console.log(`  ✓ ${rules.length} rule rows`);

  // ── 9. Applications ───────────────────────────────────────────────────────
  console.log("[Seed] Inserting applications...");
  const appStmt = db.prepare(`
    INSERT INTO applications (id, property_id, tenant_id, owner_id, status, message, applied_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-7 days'))
    ON CONFLICT(id) DO UPDATE SET status=excluded.status
  `);

  appStmt.run(
    ID.app1, ID.prop1, ID.alex, ID.sarah, 'pending',
    "Hi Sarah, I am a Computer Science junior at State University. I am very interested in this room since it is so close to campus. I am quiet, clean, and always pay rent on time. Let me know if we can arrange a viewing!"
  );

  const histStmt = db.prepare(`
    INSERT OR IGNORE INTO application_history (application_id, status, label, changed_at)
    VALUES (?, ?, ?, datetime('now', '-7 days'))
  `);
  histStmt.run(ID.app1, 'pending', 'Application submitted by Alex Mercer');

  const app2Stmt = db.prepare(`
    INSERT INTO applications (id, property_id, tenant_id, owner_id, status, message, applied_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-10 days'))
    ON CONFLICT(id) DO UPDATE SET status=excluded.status
  `);
  app2Stmt.run(
    ID.app2, ID.prop2, ID.marcus, ID.sarah, 'approved',
    "Hello Mrs. Jenkins, I am interested in renting a room in the Townhouse. I have a clean credit record and a stable co-signer."
  );

  histStmt.run(ID.app2, 'pending', 'Application submitted by Marcus Brody');
  histStmt.run(ID.app2, 'approved', 'Application approved by Sarah Jenkins');
  console.log("  ✓ 2 applications + history");

  // ── 10. Sample notifications ───────────────────────────────────────────────
  console.log("[Seed] Inserting notifications...");
  const notifs = [
    [uuidv4(), ID.alex,   "Application Received",         "Your application for University Gardens Apartment is under review.",   "application", ID.app1],
    [uuidv4(), ID.sarah,  "New Application",              "Alex Mercer applied for your University Gardens Apartment.",            "application", ID.app1],
    [uuidv4(), ID.marcus, "Application Approved",         "Your application for Modern Townhouse with Backyard was approved!",     "application", ID.app2],
    [uuidv4(), ID.chloe,  "Verification Pending",         "Your ID document has been submitted and is awaiting admin review.",     "verification", null],
    [uuidv4(), ID.alex,   "Welcome to RoomieMatch",       "Complete your profile to increase your chances of finding a match.",   "general", null],
    [uuidv4(), ID.marcus, "New Roommate Match",    "You have a 78% compatibility match with Alex Mercer!",           "general",      null],
    [uuidv4(), ID.chloe,  "New Roommate Match",    "You have a 72% compatibility match with Sarah Jenkins!",         "general",      null],
    [uuidv4(), ID.sarah,  "Property Verified",     "Your listing 'University Gardens Apartment' has been verified.", "verification", ID.prop1],
  ];

  const notifStmt = db.prepare(`
    INSERT OR IGNORE INTO notifications (id, user_id, title, message, type, reference_id, is_read)
    VALUES (?,?,?,?,?,?,0)
  `);
  for (const n of notifs) {
    notifStmt.run(...n);
  }
  console.log(`  ✓ ${notifs.length} notifications`);

  // ── 11. Sample favourites ──────────────────────────────────────────────────
  console.log("[Seed] Inserting favourites...");
  const favs = [
    [ID.alex,   ID.prop1],
    [ID.alex,   ID.prop3],
    [ID.marcus, ID.prop4],
    [ID.chloe,  ID.prop1],
    [ID.chloe,  ID.prop3],
  ];
  const favStmt = db.prepare("INSERT OR IGNORE INTO favourites (user_id, property_id) VALUES (?,?)");
  for (const f of favs) {
    favStmt.run(...f);
  }
  console.log(`  ✓ ${favs.length} favourite rows`);

  // ── 12. Reviews ───────────────────────────────────────────────────────────
  console.log("[Seed] Inserting reviews...");
  const reviews = [
    // id, reviewer_id, target_property, target_user, rating, comment
    [uuidv4(), ID.alex,   ID.prop1, null, 4.5, "Great location, very close to campus. The apartment is clean and well maintained. Sarah is a wonderful landlord — responsive and helpful."],
    [uuidv4(), ID.marcus, ID.prop2, null, 5.0, "The townhouse exceeded my expectations. Spacious, modern, and the backyard is a huge bonus. Highly recommend!"],
    [uuidv4(), ID.chloe,  ID.prop1, null, 4.0, "Really nice apartment. Quiet building and great neighbours. A little pricey but worth it for the location."],
    [uuidv4(), ID.alex,   ID.prop4, null, 4.5, "Perfect for student groups. Big kitchen, plenty of space, and easy bus access to university."],
    [uuidv4(), ID.marcus, null, ID.sarah, 5.0, "Sarah is an amazing property owner. Very professional, quick to respond, and fair with pricing."],
    [uuidv4(), ID.chloe,  null, ID.sarah, 4.5, "Had a great experience dealing with Sarah. Transparent and honest throughout the whole process."],
  ];
  const revStmt = db.prepare(`
    INSERT OR IGNORE INTO reviews (id, reviewer_id, target_property, target_user, rating, comment)
    VALUES (?,?,?,?,?,?)
  `);
  for (const r of reviews) {
    revStmt.run(...r);
  }
  console.log(`  ✓ ${reviews.length} review rows`);

  // ── 13. Compatibility scores ──────────────────────────────────────────────
  console.log("[Seed] Inserting compatibility scores...");
  const scores = [
    // user_id, candidate_id, score, budget_score, lifestyle_score, interests_score
    [ID.alex,   ID.marcus, 78, 85, 70, 80],
    [ID.alex,   ID.chloe,  65, 60, 75, 55],
    [ID.alex,   ID.sarah,  55, 50, 65, 45],
    [ID.marcus, ID.alex,   78, 85, 70, 80],
    [ID.marcus, ID.chloe,  70, 65, 80, 60],
    [ID.marcus, ID.sarah,  60, 55, 70, 50],
    [ID.chloe,  ID.alex,   65, 60, 75, 55],
    [ID.chloe,  ID.marcus, 70, 65, 80, 60],
    [ID.chloe,  ID.sarah,  72, 70, 78, 65],
  ];

  const scoreStmt = db.prepare(`
    INSERT INTO compatibility_scores
      (user_id, candidate_id, score, budget_score, lifestyle_score, interests_score)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(user_id, candidate_id) DO UPDATE SET
      score=excluded.score, budget_score=excluded.budget_score,
      lifestyle_score=excluded.lifestyle_score, interests_score=excluded.interests_score
  `);
  for (const s of scores) {
    scoreStmt.run(...s);
  }
  console.log(`  ✓ ${scores.length} compatibility score rows`);

  console.log("\n[Seed] Complete — database is ready for demo use.\n");
  console.log("Demo accounts (password: password123):");
  console.log("  admin@roomiematch.com  → Admin panel");
  console.log("  alex@user.com          → User (can search AND list properties)");
  console.log("  sarah@user.com         → User (has listed properties)");
  console.log("  marcus@user.com        → User");
  console.log("  chloe@user.com         → User (unverified)");
}

seed().catch((err) => {
  console.error("[Seed] Fatal error:", err.message);
  process.exit(1);
});
