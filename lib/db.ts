import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var mysqlPool: mysql.Pool | undefined;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getPool() {
  if (!global.mysqlPool) {
    global.mysqlPool = mysql.createPool({
      host: requiredEnv("MYSQL_HOST"),
      port: Number(process.env.MYSQL_PORT ?? 3306),
      database: requiredEnv("MYSQL_DATABASE"),
      user: requiredEnv("MYSQL_USER"),
      password: requiredEnv("MYSQL_PASSWORD"),
      connectionLimit: 10,
      namedPlaceholders: true,
      timezone: "Z"
    });
  }

  return global.mysqlPool;
}
