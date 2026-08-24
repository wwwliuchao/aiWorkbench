import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import type { AssetOpenMode, QuickServiceCard, QuickServiceGroup } from "@/types/assets";

export type AdminStatus = "active" | "inactive";
export type AdminQuickServiceCard = QuickServiceCard & { status: AdminStatus };
export type AdminQuickServiceGroup = Omit<QuickServiceGroup, "cards"> & {
  status: AdminStatus;
  cards: AdminQuickServiceCard[];
};

type GroupRow = RowDataPacket & {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  status: AdminStatus;
  created_at: Date;
  updated_at: Date;
};

type CardRow = RowDataPacket & {
  id: number;
  group_id: number;
  name: string;
  description: string | null;
  url: string;
  open_mode: AssetOpenMode;
  icon: string | null;
  color: string;
  sort_order: number;
  status: AdminStatus;
  created_at: Date;
  updated_at: Date;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanNullableText(value: unknown, maxLength: number) {
  return cleanText(value, maxLength) || null;
}

function cleanNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function cleanId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanStatus(value: unknown): AdminStatus {
  return value === "inactive" ? "inactive" : "active";
}

function cleanOpenMode(value: unknown): AssetOpenMode {
  return value === "current_tab" ? "current_tab" : "new_tab";
}

function mapGroup(row: GroupRow): AdminQuickServiceGroup {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description,
    sortOrder: Number(row.sort_order),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    cards: []
  };
}

function mapCard(row: CardRow): AdminQuickServiceCard {
  return {
    id: Number(row.id),
    groupId: Number(row.group_id),
    name: row.name,
    description: row.description,
    url: row.url,
    openMode: row.open_mode,
    icon: row.icon,
    color: row.color,
    sortOrder: Number(row.sort_order),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

async function listGroups(includeInactive: boolean): Promise<AdminQuickServiceGroup[]> {
  const statusFilter = includeInactive ? "" : "WHERE status = 'active'";
  const [rows] = await getPool().query<GroupRow[]>(
    `SELECT id, name, description, sort_order, status, created_at, updated_at
     FROM quick_service_groups
     ${statusFilter}
     ORDER BY sort_order ASC, id ASC`
  );
  return rows.map(mapGroup);
}

async function listCards(includeInactive: boolean): Promise<AdminQuickServiceCard[]> {
  const statusFilter = includeInactive ? "" : "WHERE status = 'active'";
  const [rows] = await getPool().query<CardRow[]>(
    `SELECT id, group_id, name, description, url, open_mode, icon, color,
            sort_order, status, created_at, updated_at
     FROM quick_service_cards
     ${statusFilter}
     ORDER BY sort_order ASC, id ASC`
  );
  return rows.map(mapCard);
}

export async function listQuickServiceGroups(): Promise<QuickServiceGroup[]> {
  const [groups, cards] = await Promise.all([listGroups(false), listCards(false)]);
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  cards.forEach((card) => groupMap.get(card.groupId)?.cards.push(card));
  return groups
    .filter((group) => group.cards.length > 0)
    .map(({ status: _status, cards: adminCards, ...group }) => ({
      ...group,
      cards: adminCards.map(({ status: _cardStatus, ...card }) => card)
    }));
}

export async function listAdminQuickServiceGroups(): Promise<AdminQuickServiceGroup[]> {
  const [groups, cards] = await Promise.all([listGroups(true), listCards(true)]);
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  cards.forEach((card) => groupMap.get(card.groupId)?.cards.push(card));
  return groups;
}

export async function createQuickServiceGroup(input: unknown): Promise<number> {
  const body = input as Record<string, unknown>;
  const name = cleanText(body.name, 120);
  if (!name) throw new Error("分组名称不能为空");
  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO quick_service_groups (name, description, sort_order, status)
     VALUES (:name, :description, :sortOrder, :status)`,
    {
      name,
      description: cleanNullableText(body.description, 500),
      sortOrder: cleanNumber(body.sortOrder),
      status: cleanStatus(body.status)
    }
  );
  return result.insertId;
}

export async function updateQuickServiceGroup(id: number, input: unknown): Promise<void> {
  const body = input as Record<string, unknown>;
  const name = cleanText(body.name, 120);
  if (!name) throw new Error("分组名称不能为空");
  await getPool().execute(
    `UPDATE quick_service_groups
     SET name = :name, description = :description, sort_order = :sortOrder, status = :status
     WHERE id = :id`,
    {
      id,
      name,
      description: cleanNullableText(body.description, 500),
      sortOrder: cleanNumber(body.sortOrder),
      status: cleanStatus(body.status)
    }
  );
}

function cleanCardInput(input: unknown) {
  const body = input as Record<string, unknown>;
  const groupId = cleanId(body.groupId);
  const name = cleanText(body.name, 160);
  const url = cleanText(body.url, 1000);
  if (!groupId) throw new Error("请选择快捷服务分组");
  if (!name) throw new Error("卡片名称不能为空");
  if (!url) throw new Error("跳转链接不能为空");
  return {
    groupId,
    name,
    description: cleanNullableText(body.description, 800),
    url,
    openMode: cleanOpenMode(body.openMode),
    icon: cleanNullableText(body.icon, 50),
    color: cleanText(body.color, 30) || "blue",
    sortOrder: cleanNumber(body.sortOrder),
    status: cleanStatus(body.status)
  };
}

export async function createQuickServiceCard(input: unknown): Promise<number> {
  const card = cleanCardInput(input);
  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO quick_service_cards
       (group_id, name, description, url, open_mode, icon, color, sort_order, status)
     VALUES
       (:groupId, :name, :description, :url, :openMode, :icon, :color, :sortOrder, :status)`,
    card
  );
  return result.insertId;
}

export async function updateQuickServiceCard(id: number, input: unknown): Promise<void> {
  const card = cleanCardInput(input);
  await getPool().execute(
    `UPDATE quick_service_cards
     SET group_id = :groupId, name = :name, description = :description,
         url = :url, open_mode = :openMode, icon = :icon, color = :color,
         sort_order = :sortOrder, status = :status
     WHERE id = :id`,
    { id, ...card }
  );
}
