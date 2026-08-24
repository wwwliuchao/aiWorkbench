const { loadEnvConfig } = require("@next/env");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

loadEnvConfig(process.cwd());

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    multipleStatements: true
  });
  try {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "db", "migrate_user_workcode_references.sql"),
      "utf8"
    );
    await connection.query(sql);
    const [[assets], [visits], [favorites]] = await Promise.all([
      connection.query("SELECT COUNT(*) AS count FROM assets WHERE owner_workcode IS NOT NULL"),
      connection.query("SELECT COUNT(*) AS count FROM asset_visit_logs WHERE user_workcode IS NOT NULL"),
      connection.query("SELECT COUNT(*) AS count FROM asset_favorites WHERE user_workcode IS NOT NULL")
    ]);
    console.log(JSON.stringify({
      assetOwners: assets[0].count,
      visitUsers: visits[0].count,
      favoriteUsers: favorites[0].count
    }));
  } finally {
    await connection.end();
  }
})().catch((error) => { console.error(error.message); process.exit(1); });
