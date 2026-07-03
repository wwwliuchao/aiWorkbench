import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type AdminStatus = "active" | "inactive";

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
  ownerName: string | null;
  departmentName: string | null;
  url: string;
  tags: string[];
  clickCount: number;
  sortOrder: number;
  status: AdminStatus;
  createdAt: string;
  updatedAt: string;
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
  owner_name: string | null;
  department_name: string | null;
  url: string;
  tags: string | string[] | null;
  click_count: number;
  sort_order: number;
  status: AdminStatus;
  created_at: Date;
  updated_at: Date;
};

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

function mapAsset(row: AssetRow): AdminAsset {
  return {
    id: row.id,
    directoryId: row.directory_id,
    type: row.type,
    name: row.name,
    description: row.description,
    ownerName: row.owner_name,
    departmentName: row.department_name,
    url: row.url,
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
  const [rows] = await getPool().query<AssetRow[]>(
    `SELECT id, directory_id, type, name, description, owner_name, department_name, url,
            tags, click_count, sort_order, status, created_at, updated_at
     FROM assets
     ORDER BY status ASC, sort_order ASC, id DESC`
  );

  return rows.map(mapAsset);
}

export async function createAdminAsset(input: unknown): Promise<number> {
  const body = input as Record<string, unknown>;
  const directoryId = cleanId(body.directoryId);
  const type = cleanText(body.type, 50);
  const name = cleanText(body.name, 160);
  const url = cleanText(body.url, 1000);

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

  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO assets (
        directory_id, type, name, description, owner_name, department_name,
        url, tags, sort_order, status
     )
     VALUES (
        :directoryId, :type, :name, :description, :ownerName, :departmentName,
        :url, :tags, :sortOrder, :status
     )`,
    {
      directoryId,
      type,
      name,
      description: cleanNullableText(body.description, 800),
      ownerName: cleanNullableText(body.ownerName, 80),
      departmentName: cleanNullableText(body.departmentName, 120),
      url,
      tags: JSON.stringify(cleanTags(body.tags)),
      sortOrder: cleanNumber(body.sortOrder),
      status: cleanStatus(body.status)
    }
  );

  return result.insertId;
}

export async function updateAdminAsset(id: number, input: unknown): Promise<void> {
  const body = input as Record<string, unknown>;
  const directoryId = cleanId(body.directoryId);
  const type = cleanText(body.type, 50);
  const name = cleanText(body.name, 160);
  const url = cleanText(body.url, 1000);

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

  await getPool().execute(
    `UPDATE assets
     SET directory_id = :directoryId,
         type = :type,
         name = :name,
         description = :description,
         owner_name = :ownerName,
         department_name = :departmentName,
         url = :url,
         tags = :tags,
         sort_order = :sortOrder,
         status = :status
     WHERE id = :id`,
    {
      id,
      directoryId,
      type,
      name,
      description: cleanNullableText(body.description, 800),
      ownerName: cleanNullableText(body.ownerName, 80),
      departmentName: cleanNullableText(body.departmentName, 120),
      url,
      tags: JSON.stringify(cleanTags(body.tags)),
      sortOrder: cleanNumber(body.sortOrder),
      status: cleanStatus(body.status)
    }
  );
}
