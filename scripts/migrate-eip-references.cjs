const { loadEnvConfig } = require("@next/env");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

loadEnvConfig(process.cwd());

function userName(user) {
  return user.chinese_name || user.english_name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.email || user.workcode || `用户 ${user.user_id}`;
}

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
    const migration = fs.readFileSync(path.join(process.cwd(), "db", "migrate_eip_references.sql"), "utf8");
    await connection.query(migration);

    const [assets] = await connection.query("SELECT id, owner_name, department_name FROM assets");
    const [users] = await connection.query(
      `SELECT user_id, chinese_name, english_name, first_name, last_name, email, workcode
       FROM eip.sys_user WHERE status = 1`
    );
    const [departments] = await connection.query(
      `SELECT departmentid, shortname, fullname FROM eip.departmentinfo
       WHERE COALESCE(canceled, '0') = '0'`
    );
    const userByName = new Map(users.map((user) => [userName(user).trim().toLowerCase(), user.user_id]));
    const departmentByName = new Map();
    departments.forEach((department) => {
      if (department.shortname) departmentByName.set(department.shortname.trim().toLowerCase(), department.departmentid);
      if (department.fullname) departmentByName.set(department.fullname.trim().toLowerCase(), department.departmentid);
    });

    let ownerReferences = 0;
    let departmentReferences = 0;
    for (const asset of assets) {
      const ownerUserId = asset.owner_name ? userByName.get(asset.owner_name.trim().toLowerCase()) : null;
      if (ownerUserId) {
        await connection.execute("UPDATE assets SET owner_user_id = ? WHERE id = ?", [ownerUserId, asset.id]);
        ownerReferences += 1;
      }
      const names = String(asset.department_name || "").split(/[,，]/).map((name) => name.trim()).filter(Boolean);
      for (const name of names) {
        const departmentId = departmentByName.get(name.toLowerCase());
        if (!departmentId) continue;
        await connection.execute(
          "INSERT IGNORE INTO asset_departments (asset_id, department_id) VALUES (?, ?)",
          [asset.id, departmentId]
        );
        departmentReferences += 1;
      }
    }
    const [visitResult] = await connection.query(
      `UPDATE asset_visit_logs vl
       INNER JOIN eip.sys_user u ON u.user_id = vl.user_id
       SET vl.department_id = u.department_id
       WHERE vl.department_id IS NULL`
    );
    console.log(JSON.stringify({ ownerReferences, departmentReferences, visitReferences: visitResult.affectedRows }));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
