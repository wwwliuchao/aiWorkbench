import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import type { EipDepartmentReference, EipUserReference } from "@/types/assets";

type EipUserRow = RowDataPacket & {
  user_id: number;
  email: string | null;
  chinese_name: string | null;
  english_name: string | null;
  first_name: string | null;
  last_name: string | null;
  workcode: string | null;
  department_id: string | null;
  department_name: string | null;
};

type EipDepartmentRow = RowDataPacket & {
  departmentid: string;
  shortname: string | null;
  fullname: string | null;
  supdepartmentid: string | null;
};

export function getEipUserDisplayName(row: Pick<EipUserRow, "user_id" | "chinese_name" | "english_name" | "first_name" | "last_name" | "email" | "workcode">) {
  return (
    row.chinese_name ||
    row.english_name ||
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    row.email ||
    row.workcode ||
    `用户 ${row.user_id}`
  );
}

function mapUser(row: EipUserRow): EipUserReference {
  return {
    id: row.workcode!.trim(),
    name: getEipUserDisplayName(row),
    email: row.email,
    departmentId: row.department_id,
    departmentName: row.department_name
  };
}

function mapDepartment(row: EipDepartmentRow): EipDepartmentReference {
  return {
    id: row.departmentid,
    name: row.shortname || row.fullname || row.departmentid,
    fullName: row.fullname || row.shortname || row.departmentid,
    parentId: row.supdepartmentid || null
  };
}

export async function listEipUsers(): Promise<EipUserReference[]> {
  const [rows] = await getPool().query<EipUserRow[]>(
    `SELECT user_id, email, chinese_name, english_name, first_name, last_name,
            workcode, department_id, department_name
     FROM eip.sys_user
     WHERE status = 1 AND workcode IS NOT NULL AND TRIM(workcode) <> ''
     ORDER BY COALESCE(NULLIF(chinese_name, ''), NULLIF(english_name, ''), email, workcode), user_id`
  );
  return rows.map(mapUser);
}

export async function listEipDepartments(): Promise<EipDepartmentReference[]> {
  const [rows] = await getPool().query<EipDepartmentRow[]>(
    `SELECT departmentid, shortname, fullname, supdepartmentid
     FROM eip.departmentinfo
     WHERE COALESCE(canceled, '0') = '0'
     ORDER BY COALESCE(NULLIF(fullname, ''), NULLIF(shortname, ''), departmentid), departmentid`
  );
  return rows.map(mapDepartment);
}

export async function getEipUsersByWorkcodes(workcodes: string[]): Promise<Map<string, EipUserReference>> {
  const uniqueIds = Array.from(new Set(workcodes.map((workcode) => workcode.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();
  const placeholders = uniqueIds.map((_, index) => `:workcode${index}`);
  const params = Object.fromEntries(uniqueIds.map((id, index) => [`workcode${index}`, id]));
  const [rows] = await getPool().execute<EipUserRow[]>(
    `SELECT user_id, email, chinese_name, english_name, first_name, last_name,
            workcode, department_id, department_name
     FROM eip.sys_user
     WHERE TRIM(workcode) IN (${placeholders.join(", ")})`,
    params
  );
  return new Map(rows.map((row) => [row.workcode!.trim(), mapUser(row)]));
}

export async function getEipDepartmentsByIds(ids: string[]): Promise<Map<string, EipDepartmentReference>> {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();
  const placeholders = uniqueIds.map((_, index) => `:departmentId${index}`);
  const params = Object.fromEntries(uniqueIds.map((id, index) => [`departmentId${index}`, id]));
  const [rows] = await getPool().execute<EipDepartmentRow[]>(
    `SELECT departmentid, shortname, fullname, supdepartmentid
     FROM eip.departmentinfo
     WHERE departmentid IN (${placeholders.join(", ")})`,
    params
  );
  return new Map(rows.map((row) => [row.departmentid, mapDepartment(row)]));
}

export async function validateEipReferences(ownerWorkcode: string | null, departmentIds: string[]) {
  const [users, departments] = await Promise.all([
    ownerWorkcode ? getEipUsersByWorkcodes([ownerWorkcode]) : Promise.resolve(new Map()),
    getEipDepartmentsByIds(departmentIds)
  ]);
  if (ownerWorkcode && !users.has(ownerWorkcode)) throw new Error("所选负责人不存在于 EIP 用户表");
  const missingDepartmentId = departmentIds.find((id) => !departments.has(id));
  if (missingDepartmentId) throw new Error(`所选部门不存在于 EIP 部门表：${missingDepartmentId}`);
}
