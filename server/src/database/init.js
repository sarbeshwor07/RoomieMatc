/**
 * init.js — called on server startup to verify the DB connection
 * and ensure all tables exist.
 *
 * For first-time setup run:  npm run db:migrate
 * This file only does a connectivity test at runtime.
 */
const { testConnection, run } = require("./db");

async function initDatabase() {
  await testConnection();

  // Ensure the primary administrator account name is 'Admin'
  await run(
    "UPDATE users SET name = 'Admin' WHERE role = 'admin' AND (name = 'Alex Admin' OR name LIKE '%Alex%')"
  ).catch((err) => {
    console.warn("[Init] Could not update admin name:", err.message);
  });
}

module.exports = { initDatabase };
