import crypto from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type SysUser = {
  userId: number;
  email: string | null;
  mobile: string | null;
  workcode: string | null;
  chineseName: string | null;
  englishName: string | null;
  firstName: string | null;
  lastName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  fullJobtitle: string | null;
  isManager: number | null;
};

type SysUserRow = RowDataPacket & {
  user_id: number;
  email: string | null;
  mobile: string | null;
  workcode: string | null;
  chinese_name: string | null;
  english_name: string | null;
  first_name: string | null;
  last_name: string | null;
  department_id: string | null;
  department_name: string | null;
  full_jobtitle: string | null;
  is_manager: number | null;
};

function normalizeUser(row: SysUserRow): SysUser {
  return {
    userId: row.user_id,
    email: row.email,
    mobile: row.mobile,
    workcode: row.workcode,
    chineseName: row.chinese_name,
    englishName: row.english_name,
    firstName: row.first_name,
    lastName: row.last_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    fullJobtitle: row.full_jobtitle,
    isManager: row.is_manager
  };
}

export function getDisplayName(user: SysUser) {
  return (
    user.chineseName ||
    user.englishName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    user.workcode ||
    `用户 ${user.userId}`
  );
}

function md5Upper(value: string) {
  return crypto.createHash("md5").update(value).digest("hex").toUpperCase();
}

export async function findActiveUserByEmailAndPassword(email: string, password: string) {
  const normalizedEmail = email.trim();
  const passwordHash = md5Upper(password);
  const pool = getPool();
  const [rows] = await pool.query<SysUserRow[]>(
    `SELECT user_id, email, mobile, workcode, chinese_name, english_name, first_name, last_name,
            department_id, department_name, full_jobtitle, is_manager
       FROM eip.sys_user
      WHERE status = 1
        AND workcode IS NOT NULL AND TRIM(workcode) <> ''
        AND email = :email
        AND UPPER(user_password) = :passwordHash
      LIMIT 1`,
    {
      email: normalizedEmail,
      passwordHash
    }
  );

  return rows[0] ? normalizeUser(rows[0]) : null;
}

export async function findActiveUserByEmail(email: string) {
  const pool = getPool();
  const [rows] = await pool.query<SysUserRow[]>(
    `SELECT user_id, email, mobile, workcode, chinese_name, english_name, first_name, last_name,
            department_id, department_name, full_jobtitle, is_manager
       FROM eip.sys_user
      WHERE status = 1
        AND workcode IS NOT NULL AND TRIM(workcode) <> ''
        AND email = :email
      LIMIT 1`,
    {
      email: email.trim()
    }
  );

  return rows[0] ? normalizeUser(rows[0]) : null;
}
