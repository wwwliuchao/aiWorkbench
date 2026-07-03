import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import type { Asset, AssetStats, AssetTypeDefinition, Directory } from "@/types/assets";
import type { SessionUser } from "@/lib/auth";

type DirectoryRow = RowDataPacket & {
  id: number;
  parent_id: number | null;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

type AssetRow = RowDataPacket & {
  id: number;
  directory_id: number;
  type: Asset["type"];
  name: string;
  description: string | null;
  owner_name: string | null;
  department_name: string | null;
  url: string;
  tags: string | string[] | null;
  click_count: number;
  sort_order: number;
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
  created_at: Date;
  updated_at: Date;
};

type CountRow = RowDataPacket & {
  count: number;
  click_count: number;
};

type TypeStatRow = RowDataPacket & {
  code: string;
  name: string;
  color: string;
  icon: string | null;
  count: number;
  click_count: number;
};

type DimensionStatRow = RowDataPacket & {
  name: string | null;
  click_count: number;
};

type DailyStatRow = RowDataPacket & {
  date: string;
  click_count: number;
};

type AssetVisitStatRow = RowDataPacket & {
  asset_id: number;
  click_count: number;
};

function toIso(value: Date) {
  return value.toISOString();
}

function normalizeDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

function parseTags(value: AssetRow["tags"]): string[] {
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

async function directoriesHaveParentId(): Promise<boolean> {
  return tableHasColumn("directories", "parent_id");
}

async function assetsHaveClickCount(): Promise<boolean> {
  return tableHasColumn("assets", "click_count");
}

async function assetsHaveDepartmentName(): Promise<boolean> {
  return tableHasColumn("assets", "department_name");
}

async function assetVisitLogsExist(): Promise<boolean> {
  return tableExists("asset_visit_logs");
}

async function tableHasColumn(tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = :tableName
       AND column_name = :columnName`,
    { tableName, columnName }
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

async function tableExists(tableName: string): Promise<boolean> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = :tableName`,
    { tableName }
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

export async function listDirectories(): Promise<Directory[]> {
  const hasParentId = await directoriesHaveParentId();
  const parentSelect = hasParentId ? "parent_id" : "NULL AS parent_id";

  const [rows] = await getPool().query<DirectoryRow[]>(
    `SELECT id, ${parentSelect}, name, description, sort_order, created_at, updated_at
     FROM directories
     WHERE status = 'active'
     ORDER BY COALESCE(parent_id, id) ASC, parent_id IS NOT NULL ASC, sort_order ASC, id ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  }));
}

export async function listAssets(options: {
  directoryId?: number;
  keyword?: string;
  type?: string;
}): Promise<Asset[]> {
  const hasParentId = await directoriesHaveParentId();
  const hasClickCount = await assetsHaveClickCount();
  const hasDepartmentName = await assetsHaveDepartmentName();
  const clickCountSelect = hasClickCount ? "a.click_count" : "0 AS click_count";
  const departmentNameSelect = hasDepartmentName ? "a.department_name" : "NULL AS department_name";
  const params: Record<string, string | number> = {};
  const filters = ["a.status = 'active'", "d.status = 'active'"];

  if (options.directoryId) {
    if (hasParentId) {
      const directoryIds = await listDirectoryAndDescendantIds(options.directoryId);
      const placeholders = directoryIds.map((_, index) => `:directoryId${index}`);
      directoryIds.forEach((directoryId, index) => {
        params[`directoryId${index}`] = directoryId;
      });
      filters.push(`a.directory_id IN (${placeholders.join(", ")})`);
    } else {
      filters.push("a.directory_id = :directoryId");
      params.directoryId = options.directoryId;
    }
  }

  if (options.keyword) {
    filters.push(`(
      a.name LIKE :keyword OR
      a.description LIKE :keyword OR
      a.owner_name LIKE :keyword OR
      ${hasDepartmentName ? "a.department_name LIKE :keyword OR" : ""}
      JSON_SEARCH(a.tags, 'one', :keywordText) IS NOT NULL
    )`);
    params.keyword = `%${options.keyword}%`;
    params.keywordText = `%${options.keyword}%`;
  }

  if (options.type) {
    filters.push("a.type = :type");
    params.type = options.type;
  }

  const [rows] = await getPool().execute<AssetRow[]>(
    `SELECT
       a.id,
       a.directory_id,
       a.type,
       a.name,
       a.description,
       a.owner_name,
       ${departmentNameSelect},
       a.url,
       CAST(a.tags AS CHAR) AS tags,
       ${clickCountSelect},
       a.sort_order,
       a.created_at,
       a.updated_at
     FROM assets a
     INNER JOIN directories d ON d.id = a.directory_id
     WHERE ${filters.join(" AND ")}
     ORDER BY d.sort_order ASC, a.sort_order ASC, a.id ASC`,
    params
  );

  return rows.map((row) => ({
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
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  }));
}

export async function listAssetTypes(): Promise<AssetTypeDefinition[]> {
  const [rows] = await getPool().query<AssetTypeRow[]>(
    `SELECT code, name, description, color, icon, sort_order, created_at, updated_at
     FROM asset_types
     WHERE status = 'active'
     ORDER BY sort_order ASC, code ASC`
  );

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  }));
}

export async function getAssetStats(): Promise<AssetStats> {
  const hasClickCount = await assetsHaveClickCount();
  const hasVisitLogs = await assetVisitLogsExist();
  const clickCountSelect = hasClickCount ? "COALESCE(SUM(a.click_count), 0)" : "0";
  const typeClickCountSelect = hasClickCount
    ? "COALESCE(SUM(CASE WHEN d.id IS NOT NULL THEN a.click_count ELSE 0 END), 0)"
    : "0";
  const visitCountSelect = hasVisitLogs ? "COUNT(*)" : "0";

  const [
    directoryCountResult,
    assetCountResult,
    typeStatsResult,
    periodStatsResult,
    departmentStatsResult,
    userStatsResult,
    dailyStatsResult
  ] = await Promise.all([
    getPool().query<CountRow[]>(
      `SELECT COUNT(*) AS count
       FROM directories
       WHERE status = 'active'`
    ),
    getPool().query<CountRow[]>(
      `SELECT COUNT(*) AS count, ${clickCountSelect} AS click_count
       FROM assets a
       INNER JOIN directories d ON d.id = a.directory_id
       WHERE a.status = 'active' AND d.status = 'active'`
    ),
    getPool().query<TypeStatRow[]>(
      `SELECT
         t.code,
         t.name,
         t.color,
         t.icon,
         COUNT(d.id) AS count,
         ${typeClickCountSelect} AS click_count
       FROM asset_types t
       LEFT JOIN assets a ON a.type = t.code AND a.status = 'active'
       LEFT JOIN directories d ON d.id = a.directory_id AND d.status = 'active'
       WHERE t.status = 'active'
       GROUP BY t.code, t.name, t.color, t.icon, t.sort_order
       ORDER BY t.sort_order ASC, t.code ASC`
    ),
    getPool().query<RowDataPacket[]>(
      hasVisitLogs
        ? `SELECT
             SUM(CASE WHEN visited_at >= CURRENT_DATE() THEN 1 ELSE 0 END) AS today_click_count,
             SUM(CASE WHEN visited_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS seven_day_click_count,
             SUM(CASE WHEN visited_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS thirty_day_click_count
           FROM asset_visit_logs`
        : `SELECT 0 AS today_click_count, 0 AS seven_day_click_count, 0 AS thirty_day_click_count`
    ),
    getPool().query<DimensionStatRow[]>(
      hasVisitLogs
        ? `SELECT COALESCE(NULLIF(department_name, ''), '未填写') AS name, ${visitCountSelect} AS click_count
           FROM asset_visit_logs
           WHERE visited_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           GROUP BY COALESCE(NULLIF(department_name, ''), '未填写')
           ORDER BY click_count DESC, name ASC
           LIMIT 10`
        : `SELECT NULL AS name, 0 AS click_count WHERE 1 = 0`
    ),
    getPool().query<DimensionStatRow[]>(
      hasVisitLogs
        ? `SELECT COALESCE(NULLIF(user_name, ''), NULLIF(user_email, ''), '匿名访问') AS name,
             ${visitCountSelect} AS click_count
           FROM asset_visit_logs
           WHERE visited_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           GROUP BY COALESCE(NULLIF(user_name, ''), NULLIF(user_email, ''), '匿名访问')
           ORDER BY click_count DESC, name ASC
           LIMIT 10`
        : `SELECT NULL AS name, 0 AS click_count WHERE 1 = 0`
    ),
    getPool().query<DailyStatRow[]>(
      hasVisitLogs
        ? `SELECT DATE_FORMAT(visited_at, '%Y-%m-%d') AS date, ${visitCountSelect} AS click_count
           FROM asset_visit_logs
           WHERE visited_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 13 DAY)
           GROUP BY DATE_FORMAT(visited_at, '%Y-%m-%d')
           ORDER BY date ASC`
        : `SELECT NULL AS date, 0 AS click_count WHERE 1 = 0`
    )
  ]);
  const [directoryCountRows] = directoryCountResult;
  const [assetCountRows] = assetCountResult;
  const [typeRows] = typeStatsResult;
  const [periodRows] = periodStatsResult;
  const [departmentRows] = departmentStatsResult;
  const [userRows] = userStatsResult;
  const [dailyRows] = dailyStatsResult;
  const periodRow = periodRows[0] ?? {};

  return {
    directoryCount: Number(directoryCountRows[0]?.count ?? 0),
    assetCount: Number(assetCountRows[0]?.count ?? 0),
    clickCount: Number(assetCountRows[0]?.click_count ?? 0),
    rangeClickCount: Number(periodRow.thirty_day_click_count ?? 0),
    startDate: null,
    endDate: null,
    todayClickCount: Number(periodRow.today_click_count ?? 0),
    sevenDayClickCount: Number(periodRow.seven_day_click_count ?? 0),
    thirtyDayClickCount: Number(periodRow.thirty_day_click_count ?? 0),
    typeStats: typeRows.map((row) => ({
      code: row.code,
      name: row.name,
      color: row.color,
      icon: row.icon,
      count: Number(row.count),
      clickCount: Number(row.click_count ?? 0)
    })),
    assetVisitStats: [],
    departmentStats: departmentRows.map((row) => ({
      name: row.name ?? "未填写",
      clickCount: Number(row.click_count ?? 0)
    })),
    userStats: userRows.map((row) => ({
      name: row.name ?? "匿名访问",
      clickCount: Number(row.click_count ?? 0)
    })),
    dailyStats: dailyRows.map((row) => ({
      date: row.date,
      clickCount: Number(row.click_count ?? 0)
    }))
  };
}

export async function getAssetStatsByDateRange(options: {
  startDate?: string | null;
  endDate?: string | null;
} = {}): Promise<AssetStats> {
  const baseStats = await getAssetStats();
  const hasVisitLogs = await assetVisitLogsExist();
  const startDate = normalizeDate(options.startDate);
  const endDate = normalizeDate(options.endDate);

  if (!hasVisitLogs) {
    return {
      ...baseStats,
      rangeClickCount: 0,
      startDate,
      endDate,
      assetVisitStats: [],
      departmentStats: [],
      userStats: [],
      dailyStats: []
    };
  }

  const filters: string[] = [];
  const params: Record<string, string> = {};

  if (startDate) {
    filters.push("visited_at >= :startDate");
    params.startDate = startDate;
  }
  if (endDate) {
    filters.push("visited_at < DATE_ADD(:endDate, INTERVAL 1 DAY)");
    params.endDate = endDate;
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const defaultWindowWhere =
    filters.length > 0 ? where : "WHERE visited_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
  const defaultDailyWhere =
    filters.length > 0 ? where : "WHERE visited_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 13 DAY)";

  const [
    periodStatsResult,
    assetVisitStatsResult,
    departmentStatsResult,
    userStatsResult,
    dailyStatsResult
  ] = await Promise.all([
    getPool().execute<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS range_click_count,
         SUM(CASE WHEN visited_at >= CURRENT_DATE() THEN 1 ELSE 0 END) AS today_click_count,
         SUM(CASE WHEN visited_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS seven_day_click_count,
         SUM(CASE WHEN visited_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS thirty_day_click_count
       FROM asset_visit_logs
       ${where}`,
      params
    ),
    getPool().execute<AssetVisitStatRow[]>(
      `SELECT asset_id, COUNT(*) AS click_count
       FROM asset_visit_logs
       ${defaultWindowWhere}
       GROUP BY asset_id
       ORDER BY click_count DESC, asset_id ASC`,
      params
    ),
    getPool().execute<DimensionStatRow[]>(
      `SELECT COALESCE(NULLIF(department_name, ''), '未填写') AS name, COUNT(*) AS click_count
       FROM asset_visit_logs
       ${defaultWindowWhere}
       GROUP BY COALESCE(NULLIF(department_name, ''), '未填写')
       ORDER BY click_count DESC, name ASC
       LIMIT 10`,
      params
    ),
    getPool().execute<DimensionStatRow[]>(
      `SELECT COALESCE(NULLIF(user_name, ''), NULLIF(user_email, ''), '匿名访问') AS name,
         COUNT(*) AS click_count
       FROM asset_visit_logs
       ${defaultWindowWhere}
       GROUP BY COALESCE(NULLIF(user_name, ''), NULLIF(user_email, ''), '匿名访问')
       ORDER BY click_count DESC, name ASC
       LIMIT 10`,
      params
    ),
    getPool().execute<DailyStatRow[]>(
      `SELECT DATE_FORMAT(visited_at, '%Y-%m-%d') AS date, COUNT(*) AS click_count
       FROM asset_visit_logs
       ${defaultDailyWhere}
       GROUP BY DATE_FORMAT(visited_at, '%Y-%m-%d')
       ORDER BY date ASC`,
      params
    )
  ]);

  const [periodRows] = periodStatsResult;
  const [assetVisitRows] = assetVisitStatsResult;
  const [departmentRows] = departmentStatsResult;
  const [userRows] = userStatsResult;
  const [dailyRows] = dailyStatsResult;
  const periodRow = periodRows[0] ?? {};

  return {
    ...baseStats,
    rangeClickCount: Number(periodRow.range_click_count ?? 0),
    startDate,
    endDate,
    todayClickCount: Number(periodRow.today_click_count ?? 0),
    sevenDayClickCount: Number(periodRow.seven_day_click_count ?? 0),
    thirtyDayClickCount: Number(periodRow.thirty_day_click_count ?? 0),
    assetVisitStats: assetVisitRows.map((row) => ({
      assetId: Number(row.asset_id),
      clickCount: Number(row.click_count ?? 0)
    })),
    departmentStats: departmentRows.map((row) => ({
      name: row.name ?? "未填写",
      clickCount: Number(row.click_count ?? 0)
    })),
    userStats: userRows.map((row) => ({
      name: row.name ?? "匿名访问",
      clickCount: Number(row.click_count ?? 0)
    })),
    dailyStats: dailyRows.map((row) => ({
      date: row.date,
      clickCount: Number(row.click_count ?? 0)
    }))
  };
}

export async function recordAssetClick(assetId: number, context?: {
  user?: SessionUser | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const hasClickCount = await assetsHaveClickCount();
  const hasVisitLogs = await assetVisitLogsExist();
  if (!hasClickCount && !hasVisitLogs) {
    throw new Error(
      "asset click storage is missing. Run db/migrate_asset_clicks.sql and db/migrate_asset_visit_logs.sql first."
    );
  }

  if (hasClickCount) {
    await getPool().execute(
      `UPDATE assets
       SET click_count = click_count + 1
       WHERE id = :assetId AND status = 'active'`,
      { assetId }
    );
  }

  if (!hasVisitLogs) {
    return;
  }

  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO asset_visit_logs (
       asset_id,
       user_id,
       user_name,
       user_email,
       department_name,
       ip_address,
       user_agent
     )
     SELECT
       a.id,
       :userId,
       :userName,
       :userEmail,
       COALESCE(:userDepartmentName, a.department_name),
       :ipAddress,
       :userAgent
     FROM assets a
     WHERE a.id = :assetId AND a.status = 'active'`,
    {
      assetId,
      userId: context?.user?.id ?? null,
      userName: context?.user?.name ?? null,
      userEmail: context?.user?.email ?? null,
      userDepartmentName: context?.user?.departmentName ?? null,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null
    }
  );

  if (result.affectedRows === 0) {
    throw new Error("asset not found or inactive");
  }
}

async function listDirectoryAndDescendantIds(rootDirectoryId: number): Promise<number[]> {
  const directories = await listDirectories();
  const childIdsByParentId = new Map<number, number[]>();

  directories.forEach((directory) => {
    if (!directory.parentId) {
      return;
    }

    const childIds = childIdsByParentId.get(directory.parentId) ?? [];
    childIds.push(directory.id);
    childIdsByParentId.set(directory.parentId, childIds);
  });

  const result: number[] = [];
  const stack = [rootDirectoryId];

  while (stack.length > 0) {
    const directoryId = stack.pop();
    if (!directoryId || result.includes(directoryId)) {
      continue;
    }

    result.push(directoryId);
    stack.push(...(childIdsByParentId.get(directoryId) ?? []));
  }

  return result;
}
