const { loadEnvConfig } = require("@next/env");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

loadEnvConfig(process.cwd());

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    multipleStatements: true
  });

  try {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "db", "migrate_quick_services.sql"),
      "utf8"
    );
    await connection.query(migration);
    const [rows] = await connection.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name IN ('quick_service_groups', 'quick_service_cards')
       ORDER BY table_name`
    );
    console.log(rows.map((row) => row.TABLE_NAME ?? row.table_name).join("\n"));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
