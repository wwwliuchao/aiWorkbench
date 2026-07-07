import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type RpaTask = {
  id: string;
  taskUuid: string | null;
  deptName: string;
  name: string;
  description: string | null;
  ownerName: string | null;
  requirementDocUrl: string | null;
  status: string | null;
  updatedAt: string | null;
};

export type RpaRunRecord = {
  id: string;
  taskUuid: string | null;
  taskName: string | null;
  status: string | null;
  statusDesc: string | null;
  startedAt: string | null;
  endedAt: string | null;
  duration: string | null;
  operatorName: string | null;
  message: string | null;
};

export type RpaRunRecordPage = {
  items: RpaRunRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ColumnRow = RowDataPacket & {
  column_name: string;
};

type GenericRow = RowDataPacket & Record<string, unknown>;

const taskIdColumns = ["id", "task_id", "rpa_task_id"];
const taskUuidColumns = ["task_uuid"];
const taskNameColumns = ["task_name", "name", "task_title", "title", "program_name", "job_name"];
const taskDescriptionColumns = ["description", "task_desc", "remark", "remarks", "memo"];
const taskOwnerColumns = ["owner_name", "owner", "created_by", "creator", "responsible_person", "user_name"];
const taskRequirementDocUrlColumns = ["requirement_doc_url"];
const taskStatusColumns = ["status", "task_status", "state"];
const taskUpdatedAtColumns = ["updated_at", "update_time", "update_date", "modify_time", "last_update_time"];

const recordIdColumns = ["id", "record_id", "run_id", "rpa_run_record_id"];
const recordTaskUuidColumns = ["task_uuid"];
const recordTaskNameColumns = ["task_name", "name", "task_title", "title", "program_name"];
const recordStatusColumns = ["status", "run_status", "result_status", "state", "result"];
const recordStatusDescColumns = ["status_desc"];
const recordStartedAtColumns = ["created_time", "start_time", "started_at", "begin_time", "run_start_time", "create_time", "created_at"];
const recordEndedAtColumns = ["end_time", "ended_at", "finished_at", "finish_time", "run_end_time", "update_time", "updated_at"];
const recordDurationColumns = ["duration", "run_duration", "cost_time", "elapsed_time", "time_cost"];
const recordOperatorColumns = ["operator_name", "operator", "user_name", "created_by", "creator", "runner_name"];
const recordMessageColumns = [
  "message",
  "run_message",
  "result_message",
  "error_message",
  "run_result",
  "log",
  "remark",
  "remarks",
  "memo"
];

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

function valueToString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function getValue(row: GenericRow, column: string | null) {
  return column ? valueToString(row[column]) : null;
}

function escapeIdentifier(identifier: string) {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

async function getRpaTaskColumnConfig() {
  const columns = await getTableColumns("rpa_task");
  const idColumn = pickColumn(columns, taskIdColumns);
  const taskUuidColumn = pickColumn(columns, taskUuidColumns);

  if (!columns.includes("dept_name")) {
    throw new Error("rpa_task 表缺少 dept_name 字段");
  }
  if (!idColumn) {
    throw new Error("rpa_task 表缺少任务主键字段，请使用 id、task_id 或 rpa_task_id");
  }
  if (!taskUuidColumn) {
    throw new Error("rpa_task 表缺少 task_uuid 字段");
  }

  return {
    columns,
    idColumn,
    taskUuidColumn,
    nameColumn: pickColumn(columns, taskNameColumns),
    descriptionColumn: pickColumn(columns, taskDescriptionColumns),
    ownerColumn: pickColumn(columns, taskOwnerColumns),
    requirementDocUrlColumn: pickColumn(columns, taskRequirementDocUrlColumns),
    statusColumn: pickColumn(columns, taskStatusColumns),
    updatedAtColumn: pickColumn(columns, taskUpdatedAtColumns)
  };
}

function mapRpaTask(row: GenericRow, config: Awaited<ReturnType<typeof getRpaTaskColumnConfig>>): RpaTask {
  const id = getValue(row, config.idColumn) ?? "";
  const name = getValue(row, config.nameColumn) ?? `RPA 任务 ${id}`;

  return {
    id,
    taskUuid: getValue(row, config.taskUuidColumn),
    deptName: getValue(row, "dept_name") || "未分组",
    name,
    description: getValue(row, config.descriptionColumn),
    ownerName: getValue(row, config.ownerColumn),
    requirementDocUrl: getValue(row, config.requirementDocUrlColumn),
    status: getValue(row, config.statusColumn),
    updatedAt: getValue(row, config.updatedAtColumn)
  };
}

export async function listRpaTasks(): Promise<RpaTask[]> {
  const config = await getRpaTaskColumnConfig();
  const orderBy = config.nameColumn
    ? `ORDER BY dept_name ASC, ${escapeIdentifier(config.nameColumn)} ASC`
    : "ORDER BY dept_name ASC";
  const [rows] = await getPool().query<GenericRow[]>(`SELECT * FROM rpa_task ${orderBy}`);

  return rows.map((row) => mapRpaTask(row, config));
}

export async function getRpaTask(taskId: string): Promise<RpaTask | null> {
  const config = await getRpaTaskColumnConfig();
  const [rows] = await getPool().execute<GenericRow[]>(
    `SELECT * FROM rpa_task WHERE ${escapeIdentifier(config.idColumn)} = :taskId LIMIT 1`,
    { taskId }
  );

  return rows[0] ? mapRpaTask(rows[0], config) : null;
}

export async function listRpaRunRecords(options: {
  page?: number;
  pageSize?: number;
  taskUuid?: string;
} = {}): Promise<RpaRunRecordPage> {
  const columns = await getTableColumns("rpa_run_record");
  const idColumn = pickColumn(columns, recordIdColumns);
  const taskUuidColumn = pickColumn(columns, recordTaskUuidColumns);
  const startedAtColumn = pickColumn(columns, recordStartedAtColumns);
  const pageSize = Math.min(Math.max(options.pageSize ?? 10, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  if (!idColumn) {
    throw new Error("rpa_run_record 表缺少运行记录主键字段，请使用 id、record_id 或 run_id");
  }
  if (!taskUuidColumn) {
    throw new Error("rpa_run_record 表缺少 task_uuid 字段");
  }

  const orderBy = startedAtColumn
    ? `ORDER BY ${escapeIdentifier(startedAtColumn)} DESC`
    : `ORDER BY ${escapeIdentifier(idColumn)} DESC`;
  const where = options.taskUuid ? `WHERE ${escapeIdentifier(taskUuidColumn)} = :taskUuid` : "";
  const params = options.taskUuid ? { taskUuid: options.taskUuid } : {};
  const [countRows] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM rpa_run_record ${where}`,
    params
  );
  const total = Number(countRows[0]?.total ?? 0);
  const [rows] = await getPool().execute<GenericRow[]>(
    `SELECT * FROM rpa_run_record ${where} ${orderBy} LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );

  const taskNameColumn = pickColumn(columns, recordTaskNameColumns);
  const statusColumn = pickColumn(columns, recordStatusColumns);
  const statusDescColumn = pickColumn(columns, recordStatusDescColumns);
  const endedAtColumn = pickColumn(columns, recordEndedAtColumns);
  const durationColumn = pickColumn(columns, recordDurationColumns);
  const operatorColumn = pickColumn(columns, recordOperatorColumns);
  const messageColumn = pickColumn(columns, recordMessageColumns);

  return {
    items: rows.map((row) => ({
      id: getValue(row, idColumn) ?? "",
      taskUuid: getValue(row, taskUuidColumn),
      taskName: getValue(row, taskNameColumn),
      status: getValue(row, statusColumn),
      statusDesc: getValue(row, statusDescColumn),
      startedAt: getValue(row, startedAtColumn),
      endedAt: getValue(row, endedAtColumn),
      duration: getValue(row, durationColumn),
      operatorName: getValue(row, operatorColumn),
      message: getValue(row, messageColumn)
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}
