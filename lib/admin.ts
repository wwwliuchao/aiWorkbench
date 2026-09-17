import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getEipDepartmentsByIds, getEipUsersByWorkcodes, validateEipReferences } from "@/lib/eip";

export type AdminStatus = "active" | "inactive";
export type AssetOpenMode = "current_tab" | "new_tab";

/**
 * 检查当前用户是否为管理员。
 * 如果不是管理员返回 401 响应，否则返回 null 表示通过。
 */
export function requireAdmin(): NextResponse | null {
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }
  return null;
}

export type AdminDirectory = {
  id: number;
  parentId: number | null;
  name: string;
  description: string | null;
  sortOrder: number;
  status: AdminStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminAssetType = {
  code: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  sortOrder: number;
  status: AdminStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminAsset = {
  id: number;
  directoryId: number;
  type: string;
  name: string;
  description: string | null;
  ownerWorkcode: string | null;
  ownerName: string | null;
  departmentIds: string[];
  departmentName: string | null;
  url: string;
  openMode: AssetOpenMode;
  tags: string[];
  clickCount: number;
  sortOrder: number;
  status: AdminStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminRpaTask = {
  id: string;
  taskUuid: string | null;
  deptName: string;
  name: string;
  ownerName: string | null;
  status: "启用" | "禁用" | "不存在";
  requirementDocUrl: string | null;
  relatedMaterialUrl: string | null;
  updatedAt: string | null;
};

type DirectoryRow = RowDataPacket & {
  id: number;
  parent_id: number | null;
  name: string;
  description: string | null;
  sort_order: number;
  status: AdminStatus;
  created_at: Date;
  updated_at: Date;
};

type AssetTypeRow = RowDataPacket & {
  code: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  sort_order: number;
  status: AdminStatus;
  created_at: Date;
  updated_at: Date;
};

type AssetRow = RowDataPacket & {
  id: number;
  directory_id: number;
  type: string;
  name: string;
  description: string | null;
  owner_workcode: string | null;
  url: string;
  open_mode: AssetOpenMode;
  tags: string | string[] | null;
  click_count: number;
  sort_order: number;
  status: AdminStatus;
  created_at: Date;
  updated_at: Date;
};

type AssetDepartmentRow = RowDataPacket & {
  asset_id: number;
  department_id: string;
};

type ColumnRow = RowDataPacket & {
  column_name: string;
};

type GenericRpaRow = RowDataPacket & Record<string, unknown>;

function toIso(value: Date) {
  return value.toISOString();
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanNullableText(value: unknown, maxLength: number) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function cleanId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanStatus(value: unknown): AdminStatus {
  return value === "inactive" ? "inactive" : "active";
}

function cleanCode(value: unknown) {
  return cleanText(value, 50)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanAssetOpenMode(value: unknown): AssetOpenMode {
  return value === "current_tab" ? "current_tab" : "new_tab";
}

function valueToString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function getValue(row: GenericRpaRow, column: string | null) {
  return column ? valueToString(row[column]) : null;
}

function getRpaTaskEnableStatus(
  row: GenericRpaRow,
  column: string | null
): AdminRpaTask["status"] {
  const value = getValue(row, column)?.trim();

  if (value === "1") return "启用";
  if (value === "0") return "禁用";
  return "不存在";
}

function escapeIdentifier(identifier: string) {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

async function getTableColumns(tableName: string) {
  const [rows] = await getPool().execute<ColumnRow[]>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = :tableName`,
    { tableName }
  );

  return rows.map((row) => row.column_name);
}

async function assetsHaveOpenMode() {
  const columns = await getTableColumns("assets");
  return columns.includes("open_mode");
}

function pickColumn(columns: string[], candidates: string[]) {
  const normalized = new Map(columns.map((column) => [column.toLowerCase(), column]));
  for (const candidate of candidates) {
    const column = normalized.get(candidate.toLowerCase());
    if (column) {
      return column;
    }
  }

  return null;
}

function cleanTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((tag) => cleanText(tag, 40)).filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function cleanResponsibleDepartments(value: unknown) {
  const source = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/[,，]/) : [];
  const departments = Array.from(
    new Set(source.map((department) => cleanText(department, 60)).filter(Boolean))
  );
  return cleanNullableText(departments.join(","), 120);
}

function cleanDepartmentIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((id) => cleanText(id, 128)).filter(Boolean))).slice(0, 50);
}

function parseTags(value: AssetRow["tags"]) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(String);
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
}

function mapDirectory(row: DirectoryRow): AdminDirectory {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapAssetType(row: AssetTypeRow): AdminAssetType {
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapAsset(
  row: AssetRow,
  ownerName: string | null,
  departmentIds: string[],
  departmentNames: string[]
): AdminAsset {
  return {
    id: row.id,
    directoryId: row.directory_id,
    type: row.type,
    name: row.name,
    description: row.description,
    ownerWorkcode: row.owner_workcode || null,
    ownerName,
    departmentIds,
    departmentName: departmentNames.join(",") || null,
    url: row.url,
    openMode: row.open_mode ?? "new_tab",
    tags: parseTags(row.tags),
    clickCount: Number(row.click_count ?? 0),
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

export async function listAdminDirectories(): Promise<AdminDirectory[]> {
  const [rows] = await getPool().query<DirectoryRow[]>(
    `SELECT id, parent_id, name, description, sort_order, status, created_at, updated_at
     FROM directories
     ORDER BY COALESCE(parent_id, id) ASC, parent_id IS NOT NULL ASC, sort_order ASC, id ASC`
  );

  return rows.map(mapDirectory);
}

export async function createAdminDirectory(input: unknown): Promise<number> {
  const body = input as Record<string, unknown>;
  const name = cleanText(body.name, 120);

  if (!name) {
    throw new Error("目录名称不能为空");
  }

  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO directories (parent_id, name, description, sort_order, status)
     VALUES (:parentId, :name, :description, :sortOrder, :status)`,
    {
      parentId: cleanId(body.parentId),
      name,
      description: cleanNullableText(body.description, 500),
      sortOrder: cleanNumber(body.sortOrder),
      status: cleanStatus(body.status)
    }
  );

  return result.insertId;
}

export async function updateAdminDirectory(id: number, input: unknown): Promise<void> {
  const body = input as Record<string, unknown>;
  const name = cleanText(body.name, 120);

  if (!name) {
    throw new Error("目录名称不能为空");
  }

  const parentId = cleanId(body.parentId);
  if (parentId === id) {
    throw new Error("上级目录不能选择自己");
  }

  await getPool().execute(
    `UPDATE directories
     SET parent_id = :parentId,
         name = :name,
         description = :description,
         sort_order = :sortOrder,
         status = :status
     WHERE id = :id`,
    {
      id,
      parentId,
      name,
      description: cleanNullableText(body.description, 500),
      sortOrder: cleanNumber(body.sortOrder),
      status: cleanStatus(body.status)
    }
  );
}

export async function listAdminAssetTypes(): Promise<AdminAssetType[]> {
  const [rows] = await getPool().query<AssetTypeRow[]>(
    `SELECT code, name, description, color, icon, sort_order, status, created_at, updated_at
     FROM asset_types
     ORDER BY sort_order ASC, code ASC`
  );

  return rows.map(mapAssetType);
}

export async function createAdminAssetType(input: unknown): Promise<string> {
  const body = input as Record<string, unknown>;
  const code = cleanCode(body.code);
  const name = cleanText(body.name, 80);

  if (!code) {
    throw new Error("类型编码不能为空，只能包含字母、数字、下划线和短横线");
  }
  if (!name) {
    throw new Error("类型名称不能为空");
  }

  await getPool().execute(
    `INSERT INTO asset_types (code, name, description, color, icon, sort_order, status)
     VALUES (:code, :name, :description, :color, :icon, :sortOrder, :status)`,
    {
      code,
      name,
      description: cleanNullableText(body.description, 300),
      color: cleanText(body.color, 30) || "green",
      icon: cleanNullableText(body.icon, 50),
      sortOrder: cleanNumber(body.sortOrder),
      status: cleanStatus(body.status)
    }
  );

  return code;
}

export async function updateAdminAssetType(code: string, input: unknown): Promise<void> {
  const body = input as Record<string, unknown>;
  const name = cleanText(body.name, 80);

  if (!name) {
    throw new Error("类型名称不能为空");
  }

  await getPool().execute(
    `UPDATE asset_types
     SET name = :name,
         description = :description,
         color = :color,
         icon = :icon,
         sort_order = :sortOrder,
         status = :status
     WHERE code = :code`,
    {
      code,
      name,
      description: cleanNullableText(body.description, 300),
      color: cleanText(body.color, 30) || "green",
      icon: cleanNullableText(body.icon, 50),
      sortOrder: cleanNumber(body.sortOrder),
      status: cleanStatus(body.status)
    }
  );
}

export async function listAdminAssets(): Promise<AdminAsset[]> {
  const hasOpenMode = await assetsHaveOpenMode();
  const openModeSelect = hasOpenMode ? "open_mode" : "'new_tab' AS open_mode";
  const [rows] = await getPool().query<AssetRow[]>(
    `SELECT id, directory_id, type, name, description, owner_workcode, url,
            ${openModeSelect},
            tags, click_count, sort_order, status, created_at, updated_at
     FROM assets
     ORDER BY status ASC, sort_order ASC, id DESC`
  );
  const [departmentRows] = await getPool().query<AssetDepartmentRow[]>(
    `SELECT asset_id, department_id FROM asset_departments ORDER BY asset_id, department_id`
  );
  const departmentIdsByAsset = new Map<number, string[]>();
  departmentRows.forEach((row) => {
    const ids = departmentIdsByAsset.get(Number(row.asset_id)) ?? [];
    ids.push(row.department_id);
    departmentIdsByAsset.set(Number(row.asset_id), ids);
  });
  const [userMap, departmentMap] = await Promise.all([
    getEipUsersByWorkcodes(rows.flatMap((row) => row.owner_workcode ? [row.owner_workcode] : [])),
    getEipDepartmentsByIds(departmentRows.map((row) => row.department_id))
  ]);

  return rows.map((row) => {
    const departmentIds = departmentIdsByAsset.get(Number(row.id)) ?? [];
    return mapAsset(
      row,
      row.owner_workcode ? userMap.get(row.owner_workcode)?.name ?? null : null,
      departmentIds,
      departmentIds.flatMap((id) => departmentMap.get(id)?.name ?? [])
    );
  });
}

export async function createAdminAsset(input: unknown): Promise<number> {
  const body = input as Record<string, unknown>;
  if (!(await assetsHaveOpenMode())) {
    throw new Error("缺少 assets.open_mode 字段，请先执行 db/migrate_asset_open_mode.sql");
  }
  const directoryId = cleanId(body.directoryId);
  const type = cleanText(body.type, 50);
  const name = cleanText(body.name, 160);
  const url = cleanText(body.url, 1000);
  const openMode = cleanAssetOpenMode(body.openMode);
  const ownerWorkcode = cleanNullableText(body.ownerWorkcode, 100);
  const departmentIds = cleanDepartmentIds(body.departmentIds);

  if (!directoryId) {
    throw new Error("请选择目录");
  }
  if (!type) {
    throw new Error("请选择应用类型");
  }
  if (!name) {
    throw new Error("应用名称不能为空");
  }
  if (!url) {
    throw new Error("应用链接不能为空");
  }
  await validateEipReferences(ownerWorkcode, departmentIds);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO assets (
         directory_id, type, name, description, owner_workcode,
         url, open_mode, tags, sort_order, status
       ) VALUES (
         :directoryId, :type, :name, :description, :ownerWorkcode,
         :url, :openMode, :tags, :sortOrder, :status
       )`,
      {
        directoryId, type, name, ownerWorkcode,
        description: cleanNullableText(body.description, 800),
        url, openMode,
        tags: JSON.stringify(cleanTags(body.tags)),
        sortOrder: cleanNumber(body.sortOrder),
        status: cleanStatus(body.status)
      }
    );
    for (const departmentId of departmentIds) {
      await connection.execute(
        `INSERT INTO asset_departments (asset_id, department_id) VALUES (:assetId, :departmentId)`,
        { assetId: result.insertId, departmentId }
      );
    }
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateAdminAsset(id: number, input: unknown): Promise<void> {
  const body = input as Record<string, unknown>;
  if (!(await assetsHaveOpenMode())) {
    throw new Error("缺少 assets.open_mode 字段，请先执行 db/migrate_asset_open_mode.sql");
  }
  const directoryId = cleanId(body.directoryId);
  const type = cleanText(body.type, 50);
  const name = cleanText(body.name, 160);
  const url = cleanText(body.url, 1000);
  const openMode = cleanAssetOpenMode(body.openMode);
  const ownerWorkcode = cleanNullableText(body.ownerWorkcode, 100);
  const departmentIds = cleanDepartmentIds(body.departmentIds);

  if (!directoryId) {
    throw new Error("请选择目录");
  }
  if (!type) {
    throw new Error("请选择应用类型");
  }
  if (!name) {
    throw new Error("应用名称不能为空");
  }
  if (!url) {
    throw new Error("应用链接不能为空");
  }
  await validateEipReferences(ownerWorkcode, departmentIds);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE assets
       SET directory_id = :directoryId, type = :type, name = :name,
           description = :description, owner_workcode = :ownerWorkcode,
           url = :url,
           open_mode = :openMode, tags = :tags, sort_order = :sortOrder, status = :status
       WHERE id = :id`,
      {
        id, directoryId, type, name, ownerWorkcode,
        description: cleanNullableText(body.description, 800),
        url, openMode,
        tags: JSON.stringify(cleanTags(body.tags)),
        sortOrder: cleanNumber(body.sortOrder),
        status: cleanStatus(body.status)
      }
    );
    await connection.execute(`DELETE FROM asset_departments WHERE asset_id = :id`, { id });
    for (const departmentId of departmentIds) {
      await connection.execute(
        `INSERT INTO asset_departments (asset_id, department_id) VALUES (:id, :departmentId)`,
        { id, departmentId }
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const rpaTaskIdColumns = ["id", "task_id", "rpa_task_id"];
const rpaTaskUuidColumns = ["task_uuid"];
const rpaTaskNameColumns = ["task_name", "name", "task_title", "title", "program_name", "job_name"];
const rpaTaskOwnerColumns = ["owner_name", "owner", "created_by", "creator", "responsible_person", "user_name"];
const rpaTaskEnableColumns = ["enable"];
const rpaTaskUpdatedAtColumns = ["updated_at", "update_time", "update_date", "modify_time", "last_update_time"];
const rpaTaskRequirementDocUrlColumns = ["requirement_doc_url"];
const rpaTaskRelatedMaterialUrlColumns = ["related_material_url"];

async function getAdminRpaTaskColumnConfig() {
  const columns = await getTableColumns("rpa_task");
  const idColumn = pickColumn(columns, rpaTaskIdColumns);
  const requirementDocUrlColumn = pickColumn(columns, rpaTaskRequirementDocUrlColumns);
  const relatedMaterialUrlColumn = pickColumn(columns, rpaTaskRelatedMaterialUrlColumns);

  if (!columns.includes("dept_name")) {
    throw new Error("rpa_task 表缺少 dept_name 字段");
  }
  if (!idColumn) {
    throw new Error("rpa_task 表缺少任务主键字段，请使用 id、task_id 或 rpa_task_id");
  }
  if (!requirementDocUrlColumn) {
    throw new Error("rpa_task 表缺少 requirement_doc_url 字段");
  }
  if (!relatedMaterialUrlColumn) {
    throw new Error("rpa_task 表缺少 related_material_url 字段");
  }

  return {
    idColumn,
    requirementDocUrlColumn,
    relatedMaterialUrlColumn,
    taskUuidColumn: pickColumn(columns, rpaTaskUuidColumns),
    nameColumn: pickColumn(columns, rpaTaskNameColumns),
    ownerColumn: pickColumn(columns, rpaTaskOwnerColumns),
    enableColumn: pickColumn(columns, rpaTaskEnableColumns),
    updatedAtColumn: pickColumn(columns, rpaTaskUpdatedAtColumns)
  };
}

function mapAdminRpaTask(
  row: GenericRpaRow,
  config: Awaited<ReturnType<typeof getAdminRpaTaskColumnConfig>>
): AdminRpaTask {
  const id = getValue(row, config.idColumn) ?? "";

  return {
    id,
    taskUuid: getValue(row, config.taskUuidColumn),
    deptName: getValue(row, "dept_name") || "未分组",
    name: getValue(row, config.nameColumn) ?? `RPA 任务 ${id}`,
    ownerName: getValue(row, config.ownerColumn),
    status: getRpaTaskEnableStatus(row, config.enableColumn),
    requirementDocUrl: getValue(row, config.requirementDocUrlColumn),
    relatedMaterialUrl: getValue(row, config.relatedMaterialUrlColumn),
    updatedAt: getValue(row, config.updatedAtColumn)
  };
}

export async function listAdminRpaTasks(): Promise<AdminRpaTask[]> {
  const config = await getAdminRpaTaskColumnConfig();
  const orderBy = config.nameColumn
    ? `ORDER BY dept_name ASC, ${escapeIdentifier(config.nameColumn)} ASC`
    : "ORDER BY dept_name ASC";
  const [rows] = await getPool().query<GenericRpaRow[]>(`SELECT * FROM rpa_task ${orderBy}`);

  return rows.map((row) => mapAdminRpaTask(row, config));
}

export async function updateAdminRpaTask(id: string, input: unknown): Promise<void> {
  const body = input as Record<string, unknown>;
  const config = await getAdminRpaTaskColumnConfig();

  await getPool().execute(
    `UPDATE rpa_task
     SET ${escapeIdentifier(config.requirementDocUrlColumn)} = :requirementDocUrl,
         ${escapeIdentifier(config.relatedMaterialUrlColumn)} = :relatedMaterialUrl
     WHERE ${escapeIdentifier(config.idColumn)} = :id`,
    {
      id,
      requirementDocUrl: cleanNullableText(body.requirementDocUrl, 1000),
      relatedMaterialUrl: cleanNullableText(body.relatedMaterialUrl, 1000)
    }
  );
}
