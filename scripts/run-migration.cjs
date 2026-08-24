const { loadEnvConfig } = require("@next/env");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

loadEnvConfig(process.cwd());

(async () => {
  const migrationName = process.argv[2];
  if (!migrationName || !/^[a-zA-Z0-9_.-]+\.sql$/.test(migrationName)) {
    throw new Error("Usage: node scripts/run-migration.cjs <migration.sql>");
  }
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    multipleStatements: true
  });
  try {
    const sql = fs.readFileSync(path.join(process.cwd(), "db", migrationName), "utf8");
    await connection.query(sql);
    console.log(`${migrationName} applied`);
  } finally {
    await connection.end();
  }
})().catch((error) => { console.error(error.message); process.exit(1); });
