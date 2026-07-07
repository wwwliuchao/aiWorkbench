"use client";

import { useEffect, useMemo, useState } from "react";
import type { Asset, AssetStats, AssetTypeDefinition, Directory } from "@/types/assets";
import type { SessionUser } from "@/lib/auth";
import { withBasePath } from "@/lib/public-path";

type ApiState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

type DirectoryNode = Directory & {
  children: DirectoryNode[];
};

type ActiveView = "home" | "directory" | "favorites" | "stats" | "admin" | "rpa" | "rpaLogs";

type RpaTask = {
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

type RpaRunRecord = {
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

type AdminStatus = "active" | "inactive";

type AdminDirectory = Directory & {
  status: AdminStatus;
};

type AdminAssetType = AssetTypeDefinition & {
  status: AdminStatus;
};

type AdminAsset = Asset & {
  status: AdminStatus;
};

type DirectoryFormState = {
  parentId: string;
  name: string;
  description: string;
  sortOrder: string;
  status: AdminStatus;
};

type AssetTypeFormState = {
  code: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: string;
  status: AdminStatus;
};

type AssetFormState = {
  directoryId: string;
  type: string;
  name: string;
  description: string;
  ownerName: string;
  departmentName: string;
  url: string;
  tags: string;
  sortOrder: string;
  status: AdminStatus;
};

type AdminRpaTask = {
  id: string;
  taskUuid: string | null;
  deptName: string;
  name: string;
  ownerName: string | null;
  status: string | null;
  requirementDocUrl: string | null;
  updatedAt: string | null;
};

type RpaTaskFormState = {
  name: string;
  deptName: string;
  taskUuid: string;
  requirementDocUrl: string;
};

const defaultStats: AssetStats = {
  directoryCount: 0,
  assetCount: 0,
  clickCount: 0,
  rangeClickCount: 0,
  startDate: null,
  endDate: null,
  todayClickCount: 0,
  sevenDayClickCount: 0,
  thirtyDayClickCount: 0,
  assetVisitStats: [],
  departmentStats: [],
  userStats: [],
  dailyStats: [],
  typeStats: []
};

const colorClassByName: Record<string, string> = {
  green: "typeGreen",
  blue: "typeBlue",
  purple: "typePurple",
  orange: "typeOrange",
  gray: "typeGray"
};

function getTypeColorClass(color?: string) {
  return colorClassByName[color ?? ""] ?? "typeGreen";
}

function getTypeIcon(icon?: string | null) {
  const iconMap: Record<string, string> = {
    table: "▦",
    base: "▦",
    workflow: "◇",
    workflow1: "◇",
    chart: "▥",
    report: "▥",
    link: "↗",
    system: "▣"
  };

  return icon ? iconMap[icon] ?? icon : "◇";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(withBasePath(url), { cache: "no-store", credentials: "include" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "请求失败");
  }

  return payload.data as T;
}

async function fetchFavoriteAssetIds(): Promise<number[]> {
  return fetchJson<number[]>("/api/favorites");
}

async function addFavoriteAsset(assetId: number): Promise<void> {
  await sendJson<{ ok: true; assetId: number }>("/api/favorites", "POST", { assetId });
}

async function removeFavoriteAsset(assetId: number): Promise<void> {
  const response = await fetch(withBasePath(`/api/favorites/${assetId}`), {
    method: "DELETE",
    credentials: "include"
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "取消收藏失败");
  }
}

async function sendJson<T>(url: string, method: "POST" | "PUT", body: unknown): Promise<T> {
  const response = await fetch(withBasePath(url), {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "保存失败");
  }

  return payload.data as T;
}

function recordAssetOpen(assetId: number) {
  const url = withBasePath(`/api/assets/${assetId}/click`);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url);
    return;
  }

  fetch(url, { method: "POST", keepalive: true, credentials: "include" }).catch(() => undefined);
}

function buildDirectoryTree(directories: Directory[]): DirectoryNode[] {
  const nodeMap = new Map<number, DirectoryNode>();
  const roots: DirectoryNode[] = [];

  directories.forEach((directory) => {
    nodeMap.set(directory.id, { ...directory, children: [] });
  });

  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)?.children.push(node);
      return;
    }

    roots.push(node);
  });

  const sortNodes = (nodes: DirectoryNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

function DirectoryTreeItem({
  node,
  selectedDirectoryId,
  collapsedDirectoryIds,
  onSelect,
  onToggle
}: {
  node: DirectoryNode;
  selectedDirectoryId: number | null;
  collapsedDirectoryIds: Set<number>;
  onSelect: (directoryId: number) => void;
  onToggle: (directoryId: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsedDirectoryIds.has(node.id);
  const isActive = selectedDirectoryId === node.id;

  return (
    <div className="navGroup">
      <div className={isActive ? "parentNav active" : "parentNav"}>
        <button
          className="collapseControl"
          type="button"
          onClick={() => (hasChildren ? onToggle(node.id) : onSelect(node.id))}
          title={hasChildren ? (isCollapsed ? "展开目录" : "收起目录") : "选择目录"}
        >
          {hasChildren ? (isCollapsed ? "▸" : "▾") : "·"}
        </button>
        <button className="parentLabel" type="button" onClick={() => onSelect(node.id)}>
          <span>{hasChildren ? "▣" : "□"}</span>
          <strong>{node.name}</strong>
        </button>
      </div>

      {!isCollapsed && hasChildren ? (
        <div className="childNavList">
          {node.children.map((child) => (
            <DirectoryTreeItem
              key={child.id}
              node={child}
              selectedDirectoryId={selectedDirectoryId}
              collapsedDirectoryIds={collapsedDirectoryIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TypeFilterBar({
  assetTypes,
  selectedType,
  onSelectType
}: {
  assetTypes: AssetTypeDefinition[];
  selectedType: string | null;
  onSelectType: (type: string | null) => void;
}) {
  return (
    <section className="quickGrid" aria-label="资产类型筛选">
      <button
        className={selectedType === null ? "quickAction active" : "quickAction"}
        type="button"
        onClick={() => onSelectType(null)}
      >
        <span>⌂</span>
        全部入口
      </button>
      {assetTypes.map((assetType) => (
        <button
          className={selectedType === assetType.code ? "quickAction active" : "quickAction"}
          key={assetType.code}
          type="button"
          onClick={() => onSelectType(assetType.code)}
        >
          <span>{getTypeIcon(assetType.icon)}</span>
          {assetType.name}
        </button>
      ))}
    </section>
  );
}

function FavoriteToggleButton({
  active,
  disabled,
  onToggle
}: {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={active ? "favoriteButton active" : "favoriteButton"}
      type="button"
      title={active ? "取消收藏" : "加入收藏"}
      aria-label={active ? "取消收藏" : "加入收藏"}
      disabled={disabled}
      onClick={onToggle}
    >
      {active ? "★" : "☆"}
    </button>
  );
}

function AssetListPanel({
  title,
  description,
  keyword,
  onKeywordChange,
  assets,
  loading,
  error,
  assetTypeMap,
  favoriteAssetIds,
  favoritePendingIds,
  onToggleFavorite
}: {
  title: string;
  description: string;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  assets: Asset[];
  loading: boolean;
  error: string | null;
  assetTypeMap: Map<string, AssetTypeDefinition>;
  favoriteAssetIds: Set<number>;
  favoritePendingIds: Set<number>;
  onToggleFavorite: (assetId: number) => void;
}) {
  return (
    <div className="assetTablePanel">
      <div className="panelTitleRow">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="searchBox">
          <span>搜索</span>
          <input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="名称、说明、负责人、部门、标签"
          />
        </div>
      </div>

      {error ? (
        <div className="emptyState">
          <h3>无法读取资产数据</h3>
          <p>{error}</p>
        </div>
      ) : null}

      {loading && assets.length === 0 ? (
        <div className="skeletonList" aria-label="资产加载中">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="skeletonRow" key={index}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !error && assets.length === 0 ? (
        <div className="emptyState">
          <h3>暂无应用</h3>
        </div>
      ) : null}

      {assets.length > 0 ? (
        <div className="assetTable">
          <div className="assetTableHead">
            <span>应用名称</span>
            <span>类型</span>
            <span>负责人</span>
            <span>部门</span>
            <span>标签</span>
          </div>
          {assets.map((asset) => (
            <div className="assetTableRow" key={asset.id}>
              <div>
                <div className="assetTitleBar">
                  <a
                    className="assetNameLink"
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => recordAssetOpen(asset.id)}
                  >
                    {asset.name}
                  </a>
                  <FavoriteToggleButton
                    active={favoriteAssetIds.has(asset.id)}
                    disabled={favoritePendingIds.has(asset.id)}
                    onToggle={() => onToggleFavorite(asset.id)}
                  />
                </div>
                <p>{asset.description || "暂无说明"}</p>
              </div>
              <span className={`typePill ${getTypeColorClass(assetTypeMap.get(asset.type)?.color)}`}>
                {assetTypeMap.get(asset.type)?.name ?? asset.type}
              </span>
              <span>{asset.ownerName || "未填写"}</span>
              <span>{asset.departmentName || "未填写"}</span>
              <div className="tags">
                {asset.tags.length > 0 ? asset.tags.map((tag) => <span key={tag}>{tag}</span>) : "无"}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RpaTaskPanel({
  tasks,
  departments,
  statuses,
  selectedDept,
  keyword,
  selectedStatus,
  loading,
  error,
  onKeywordChange,
  onSelectDept,
  onSelectStatus,
  onResetFilters,
  onViewLogs
}: {
  tasks: RpaTask[];
  departments: string[];
  statuses: string[];
  selectedDept: string | null;
  keyword: string;
  selectedStatus: string | null;
  loading: boolean;
  error: string | null;
  onKeywordChange: (keyword: string) => void;
  onSelectDept: (deptName: string | null) => void;
  onSelectStatus: (status: string | null) => void;
  onResetFilters: () => void;
  onViewLogs: (task: RpaTask) => void;
}) {
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  async function startTask(task: RpaTask) {
    setStartingTaskId(task.id);
    setMessage(null);
    setStartError(null);

    try {
      const response = await fetch(withBasePath(`/api/rpa/tasks/${encodeURIComponent(task.id)}/start`), {
        method: "POST",
        credentials: "include"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "启动请求失败");
      }

      setMessage(`${task.name}：${payload.data?.message ?? "启动请求已发送"}`);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "启动请求失败");
    } finally {
      setStartingTaskId(null);
    }
  }

  return (
    <section className="directoryDetail">
      <div className="detailHeader">
        <div>
          <h1>{selectedDept ? `实在RPA / ${selectedDept}` : "实在RPA"}</h1>
          <span>按任务名称、部门和状态筛选 RPA 任务，点击启动程序会调用后端启动接口。</span>
        </div>
      </div>

      <section className="statsFilterBar" aria-label="RPA 任务筛选">
        <label>
          <span>任务名称</span>
          <input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="输入任务名称搜索"
          />
        </label>
        <label>
          <span>部门</span>
          <select value={selectedDept ?? ""} onChange={(event) => onSelectDept(event.target.value || null)}>
            <option value="">全部部门</option>
            {departments.map((deptName) => (
              <option key={deptName} value={deptName}>
                {deptName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select value={selectedStatus ?? ""} onChange={(event) => onSelectStatus(event.target.value || null)}>
            <option value="">全部状态</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onResetFilters} disabled={!keyword && !selectedDept && !selectedStatus}>
          重置
        </button>
      </section>

      <div className="assetTablePanel">
        <div className="panelTitleRow">
          <div>
            <h2>RPA 任务</h2>
            <p>当前共 {tasks.length} 个任务。</p>
          </div>
        </div>

        {message ? <div className="adminNotice success">{message}</div> : null}
        {startError ? <div className="adminNotice error">{startError}</div> : null}

        {error ? (
          <div className="emptyState">
            <h3>无法读取 RPA 任务</h3>
            <p>{error}</p>
          </div>
        ) : null}

        {loading && tasks.length === 0 ? (
          <div className="skeletonList" aria-label="RPA 任务加载中">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="skeletonRow" key={index}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !error && tasks.length === 0 ? (
          <div className="emptyState">
            <h3>暂无 RPA 任务</h3>
            <p>请确认 rpa_task 表已有数据，并且包含 dept_name 字段。</p>
          </div>
        ) : null}

        <div className="rpaTable">
          <div className="rpaTableHead">
            <span>任务名称</span>
            <span>部门</span>
            <span>需求文档</span>
            <span>状态</span>
            <span>更新时间</span>
            <span>操作</span>
            <span>日志</span>
          </div>
          {tasks.map((task) => (
            <div className="rpaTableRow" key={task.id}>
              <div>
                <strong>{task.name}</strong>
              </div>
              <span>{task.deptName}</span>
              <span>
                {task.requirementDocUrl ? (
                  <a className="assetNameLink inlineLink" href={task.requirementDocUrl} target="_blank" rel="noreferrer">
                    查看文档
                  </a>
                ) : (
                  "未填写"
                )}
              </span>
              <span>{task.status || "未填写"}</span>
              <span>{task.updatedAt ? task.updatedAt.slice(0, 19).replace("T", " ") : "未填写"}</span>
              <button
                className="rpaActionButton"
                type="button"
                disabled={startingTaskId === task.id}
                onClick={() => startTask(task)}
              >
                {startingTaskId === task.id ? "启动中..." : "启动程序"}
              </button>
              <button
                className="rpaActionButton secondary"
                type="button"
                disabled={!task.taskUuid}
                onClick={() => onViewLogs(task)}
              >
                日志
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RpaLogPanel({
  task,
  records,
  loading,
  error,
  onBack
}: {
  task: RpaTask;
  records: RpaRunRecord[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <section className="directoryDetail">
      <div className="detailHeader">
        <div>
          <h1>{task.name} / 运行日志</h1>
          <span>
            {task.deptName} · {task.taskUuid ?? "未配置 task_uuid"}
          </span>
        </div>
        <button className="secondaryButton" type="button" onClick={onBack}>
          返回任务列表
        </button>
      </div>

      <div className="assetTablePanel">
        <div className="panelTitleRow">
          <div>
            <h2>运行记录</h2>
            <p>只展示当前 RPA 程序的 rpa_run_record 记录。</p>
          </div>
        </div>

        {error ? (
          <div className="emptyState">
            <h3>无法读取运行记录</h3>
            <p>{error}</p>
          </div>
        ) : null}

        {loading && records.length === 0 ? (
          <div className="skeletonList" aria-label="RPA 运行记录加载中">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="skeletonRow" key={index}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !error && records.length === 0 ? (
          <div className="emptyState">
            <h3>暂无运行记录</h3>
            <p>该程序还没有匹配到 task_uuid 对应的运行记录。</p>
          </div>
        ) : null}

        <div className="rpaRecordTable">
          <div className="rpaRecordTableHead">
            <span>任务名称</span>
            <span>部门</span>
            <span>状态</span>
            <span>开始时间</span>
            <span>结束时间</span>
            <span>耗时</span>
            <span>执行信息</span>
          </div>
          {records.map((record) => (
            <div className="rpaRecordTableRow" key={record.id}>
              <div>
                <strong>{record.taskName ?? task.name}</strong>
                <p>{record.operatorName ? `操作人：${record.operatorName}` : "未记录操作人"}</p>
              </div>
              <span>{task.deptName}</span>
              <span>{record.statusDesc || record.status || "未填写"}</span>
              <span>{record.startedAt ? record.startedAt.slice(0, 19).replace("T", " ") : "未填写"}</span>
              <span>{record.endedAt ? record.endedAt.slice(0, 19).replace("T", " ") : "未填写"}</span>
              <span>{record.duration || "未填写"}</span>
              <span>{record.message || "无"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsReport({
  assets,
  loading,
  error,
  assetTypeMap,
  favoriteAssetIds,
  favoritePendingIds,
  onToggleFavorite
}: {
  assets: Asset[];
  loading: boolean;
  error: string | null;
  assetTypeMap: Map<string, AssetTypeDefinition>;
  favoriteAssetIds: Set<number>;
  favoritePendingIds: Set<number>;
  onToggleFavorite: (assetId: number) => void;
}) {
  const sortedAssets = useMemo(
    () => [...assets].sort((left, right) => right.clickCount - left.clickCount || left.id - right.id),
    [assets]
  );
  const totalClickCount = sortedAssets.reduce((sum, asset) => sum + asset.clickCount, 0);
  const activeAssetCount = sortedAssets.length;
  const topAsset = sortedAssets[0];

  return (
    <section className="statsReport">
      <div className="detailHeader">
        <div>
          <h1>访问统计报表</h1>
          <span>按应用维度统计点击访问量，用于查看哪些入口被使用得更多。</span>
        </div>
      </div>

      <div className="statsSummary">
        <div className="metricCard">
          <span>总访问数</span>
          <strong>{totalClickCount}</strong>
        </div>
        <div className="metricCard">
          <span>应用数量</span>
          <strong>{activeAssetCount}</strong>
        </div>
        <div className="metricCard">
          <span>最高访问应用</span>
          <strong>{topAsset?.clickCount ?? 0}</strong>
          <p>{topAsset?.name ?? "暂无数据"}</p>
        </div>
      </div>

      <div className="statsTablePanel">
        <div className="panelTitleRow">
          <div>
            <h2>应用访问排行</h2>
            <p>点击应用名称仍会打开对应链接并累计访问数。</p>
          </div>
        </div>

        {error ? (
          <div className="emptyState">
            <h3>无法读取统计数据</h3>
            <p>{error}</p>
          </div>
        ) : null}

        {loading && sortedAssets.length === 0 ? (
          <div className="skeletonList" aria-label="统计加载中">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="skeletonRow" key={index}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !error && sortedAssets.length === 0 ? (
          <div className="emptyState">
            <h3>暂无统计数据</h3>
            <p>新增 active 状态的应用后，这里会展示访问量。</p>
          </div>
        ) : null}

        <div className="statsTable">
          <div className="statsTableHead">
            <span>应用名称</span>
            <span>类型</span>
            <span>负责人</span>
            <span>部门</span>
            <span>访问数</span>
          </div>
          {sortedAssets.map((asset) => (
            <div className="statsTableRow" key={asset.id}>
              <div>
                <div className="assetTitleBar">
                  <a
                    className="assetNameLink"
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => recordAssetOpen(asset.id)}
                  >
                    {asset.name}
                  </a>
                  <FavoriteToggleButton
                    active={favoriteAssetIds.has(asset.id)}
                    disabled={favoritePendingIds.has(asset.id)}
                    onToggle={() => onToggleFavorite(asset.id)}
                  />
                </div>
                <p>{asset.description || "暂无说明"}</p>
              </div>
              <span className={`typePill ${getTypeColorClass(assetTypeMap.get(asset.type)?.color)}`}>
                {assetTypeMap.get(asset.type)?.name ?? asset.type}
              </span>
              <span>{asset.ownerName || "未填写"}</span>
              <span>{asset.departmentName || "未填写"}</span>
              <strong className="clickCount">{asset.clickCount}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DimensionRanking({
  title,
  items,
  emptyText
}: {
  title: string;
  items: { name: string; clickCount: number }[];
  emptyText: string;
}) {
  return (
    <div className="statsTablePanel">
      <div className="panelTitleRow compact">
        <div>
          <h2>{title}</h2>
          <p>统计近 30 天访问数据。</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="emptyState compact">
          <h3>{emptyText}</h3>
          <p>执行访问日志迁移后，新产生的点击会进入这里。</p>
        </div>
      ) : (
        <div className="dimensionList">
          {items.map((item, index) => (
            <div className="dimensionItem" key={`${item.name}-${index}`}>
              <span>{index + 1}</span>
              <strong>{item.name}</strong>
              <em>{item.clickCount}</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EnhancedStatsReport({
  assets,
  stats,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onResetDateRange,
  loading,
  error,
  assetTypeMap,
  assetTypes,
  statsType,
  onStatsTypeChange,
  favoriteAssetIds,
  favoritePendingIds,
  onToggleFavorite
}: {
  assets: Asset[];
  stats: AssetStats;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onResetDateRange: () => void;
  loading: boolean;
  error: string | null;
  assetTypeMap: Map<string, AssetTypeDefinition>;
  assetTypes: AssetTypeDefinition[];
  statsType: string | null;
  onStatsTypeChange: (type: string | null) => void;
  favoriteAssetIds: Set<number>;
  favoritePendingIds: Set<number>;
  onToggleFavorite: (assetId: number) => void;
}) {
  const hasDateRange = Boolean(startDate || endDate);
  const sortedAssets = useMemo(
    () => {
      const rangeClickMap = new Map(stats.assetVisitStats.map((item) => [item.assetId, item.clickCount]));
      return [...assets].sort((left, right) => {
        const leftCount = hasDateRange ? rangeClickMap.get(left.id) ?? 0 : left.clickCount;
        const rightCount = hasDateRange ? rangeClickMap.get(right.id) ?? 0 : right.clickCount;
        return rightCount - leftCount || left.id - right.id;
      });
    },
    [assets, hasDateRange, stats.assetVisitStats]
  );
  const rangeClickMap = useMemo(
    () => new Map(stats.assetVisitStats.map((item) => [item.assetId, item.clickCount])),
    [stats.assetVisitStats]
  );
  const totalClickCount = hasDateRange ? stats.rangeClickCount : stats.clickCount;
  const topAsset = sortedAssets[0];
  const topAssetClickCount = topAsset
    ? hasDateRange
      ? rangeClickMap.get(topAsset.id) ?? 0
      : topAsset.clickCount
    : 0;
  const maxDailyClickCount = Math.max(...stats.dailyStats.map((item) => item.clickCount), 1);

  return (
    <section className="statsReport">
      <div className="detailHeader">
        <div>
          <h1>访问统计报表</h1>
          <span>按应用、时间、部门和用户维度统计入口访问情况。</span>
        </div>
      </div>

      <div className="statsFilterBar">
        <label>
          <span>开始日期</span>
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => onStartDateChange(event.target.value)}
          />
        </label>
        <label>
          <span>结束日期</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        </label>
        <button type="button" onClick={onResetDateRange} disabled={!hasDateRange}>
          重置
        </button>
        <div className="statsFilterDivider" />
        <label>
          <span>应用类型</span>
          <select
            value={statsType ?? ""}
            onChange={(event) => onStatsTypeChange(event.target.value || null)}
          >
            <option value="">全部类型</option>
            {assetTypes.map((assetType) => (
              <option key={assetType.code} value={assetType.code}>
                {assetType.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="statsSummary expanded">
        <div className="metricCard">
          <span>{hasDateRange ? "区间访问" : "总访问数"}</span>
          <strong>{totalClickCount}</strong>
        </div>
        <div className="metricCard">
          <span>今日访问</span>
          <strong>{stats.todayClickCount}</strong>
        </div>
        <div className="metricCard">
          <span>近 7 天访问</span>
          <strong>{stats.sevenDayClickCount}</strong>
        </div>
        <div className="metricCard">
          <span>近 30 天访问</span>
          <strong>{stats.thirtyDayClickCount}</strong>
        </div>
        <div className="metricCard">
          <span>应用数量</span>
          <strong>{sortedAssets.length}</strong>
        </div>
        <div className="metricCard">
          <span>最高访问应用</span>
          <strong>{topAssetClickCount}</strong>
          <p>{topAsset?.name ?? "暂无数据"}</p>
        </div>
      </div>

      <div className="statsInsightGrid">
        <div className="statsTablePanel">
          <div className="panelTitleRow compact">
            <div>
              <h2>近 14 天趋势</h2>
              <p>基于访问日志明细统计。</p>
            </div>
          </div>
          {stats.dailyStats.length === 0 ? (
            <div className="emptyState compact">
              <h3>暂无趋势数据</h3>
              <p>执行访问日志迁移后，新产生的点击会进入趋势统计。</p>
            </div>
          ) : (
            <div className="dailyTrend">
              {stats.dailyStats.map((item) => (
                <div className="dailyTrendItem" key={item.date}>
                  <div>
                    <span>{item.date.slice(5)}</span>
                    <strong>{item.clickCount}</strong>
                  </div>
                  <i style={{ height: `${Math.max(8, (item.clickCount / maxDailyClickCount) * 92)}%` }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <DimensionRanking title="部门访问排行" items={stats.departmentStats} emptyText="暂无部门访问数据" />
        <DimensionRanking title="用户访问排行" items={stats.userStats} emptyText="暂无用户访问数据" />
      </div>

      <div className="statsTablePanel">
        <div className="panelTitleRow">
          <div>
            <h2>应用访问排行</h2>
            <p>点击应用名称仍会打开对应链接并累计访问数。</p>
          </div>
        </div>

        {error ? (
          <div className="emptyState">
            <h3>无法读取统计数据</h3>
            <p>{error}</p>
          </div>
        ) : null}

        {!loading && !error && sortedAssets.length === 0 ? (
          <div className="emptyState">
            <h3>暂无统计数据</h3>
            <p>新增 active 状态的应用后，这里会展示访问量。</p>
          </div>
        ) : null}

        <div className="statsTable">
          <div className="statsTableHead">
            <span>应用名称</span>
            <span>类型</span>
            <span>负责人</span>
            <span>部门</span>
            <span>访问数</span>
          </div>
          {sortedAssets.map((asset) => (
            <div className="statsTableRow" key={asset.id}>
              <div>
                <div className="assetTitleBar">
                  <a
                    className="assetNameLink"
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => recordAssetOpen(asset.id)}
                  >
                    {asset.name}
                  </a>
                  <FavoriteToggleButton
                    active={favoriteAssetIds.has(asset.id)}
                    disabled={favoritePendingIds.has(asset.id)}
                    onToggle={() => onToggleFavorite(asset.id)}
                  />
                </div>
                <p>{asset.description || "暂无说明"}</p>
              </div>
              <span className={`typePill ${getTypeColorClass(assetTypeMap.get(asset.type)?.color)}`}>
                {assetTypeMap.get(asset.type)?.name ?? asset.type}
              </span>
              <span>{asset.ownerName || "未填写"}</span>
              <span>{asset.departmentName || "未填写"}</span>
              <strong className="clickCount">
                {hasDateRange ? rangeClickMap.get(asset.id) ?? 0 : asset.clickCount}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const emptyDirectoryForm: DirectoryFormState = {
  parentId: "",
  name: "",
  description: "",
  sortOrder: "0",
  status: "active"
};

const emptyAssetTypeForm: AssetTypeFormState = {
  code: "",
  name: "",
  description: "",
  color: "green",
  icon: "link",
  sortOrder: "0",
  status: "active"
};

const emptyAssetForm: AssetFormState = {
  directoryId: "",
  type: "",
  name: "",
  description: "",
  ownerName: "",
  departmentName: "",
  url: "",
  tags: "",
  sortOrder: "0",
  status: "active"
};

const emptyRpaTaskForm: RpaTaskFormState = {
  name: "",
  deptName: "",
  taskUuid: "",
  requirementDocUrl: ""
};

function AdminPanel({ onDataChanged }: { onDataChanged: () => void }) {
  const [activeTab, setActiveTab] = useState<"directories" | "assets" | "types" | "rpaTasks">("assets");
  const [directories, setDirectories] = useState<AdminDirectory[]>([]);
  const [assetTypes, setAssetTypes] = useState<AdminAssetType[]>([]);
  const [assets, setAssets] = useState<AdminAsset[]>([]);
  const [rpaTasks, setRpaTasks] = useState<AdminRpaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingDirectoryId, setEditingDirectoryId] = useState<number | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editingAssetTypeCode, setEditingAssetTypeCode] = useState<string | null>(null);
  const [editingRpaTaskId, setEditingRpaTaskId] = useState<string | null>(null);
  const [directoryForm, setDirectoryForm] = useState<DirectoryFormState>(emptyDirectoryForm);
  const [assetTypeForm, setAssetTypeForm] = useState<AssetTypeFormState>(emptyAssetTypeForm);
  const [assetForm, setAssetForm] = useState<AssetFormState>(emptyAssetForm);
  const [rpaTaskForm, setRpaTaskForm] = useState<RpaTaskFormState>(emptyRpaTaskForm);

  async function loadAdminData() {
    setLoading(true);
    setError(null);

    try {
      const [nextDirectories, nextTypes, nextAssets, nextRpaTasks] = await Promise.all([
        fetchJson<AdminDirectory[]>("/api/admin/directories"),
        fetchJson<AdminAssetType[]>("/api/admin/asset-types"),
        fetchJson<AdminAsset[]>("/api/admin/assets"),
        fetchJson<AdminRpaTask[]>("/api/admin/rpa-tasks")
      ]);
      setDirectories(nextDirectories);
      setAssetTypes(nextTypes);
      setAssets(nextAssets);
      setRpaTasks(nextRpaTasks);
    } catch (loadError) {
      const text = loadError instanceof Error ? loadError.message : "后台数据加载失败";
      setError(text);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  function completeSave(text: string) {
    setMessage(text);
    loadAdminData();
    onDataChanged();
  }

  async function saveDirectory() {
    setSaving(true);
    setError(null);

    const payload = {
      ...directoryForm,
      parentId: directoryForm.parentId ? Number(directoryForm.parentId) : null,
      sortOrder: Number(directoryForm.sortOrder || 0)
    };

    try {
      if (editingDirectoryId) {
        await sendJson(`/api/admin/directories/${editingDirectoryId}`, "PUT", payload);
      } else {
        await sendJson("/api/admin/directories", "POST", payload);
      }
      setDirectoryForm(emptyDirectoryForm);
      setEditingDirectoryId(null);
      completeSave("目录已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "目录保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveAssetType() {
    setSaving(true);
    setError(null);

    const payload = {
      ...assetTypeForm,
      sortOrder: Number(assetTypeForm.sortOrder || 0)
    };

    try {
      if (editingAssetTypeCode) {
        await sendJson(`/api/admin/asset-types/${encodeURIComponent(editingAssetTypeCode)}`, "PUT", payload);
      } else {
        await sendJson("/api/admin/asset-types", "POST", payload);
      }
      setAssetTypeForm(emptyAssetTypeForm);
      setEditingAssetTypeCode(null);
      completeSave("应用类型已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "应用类型保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveAsset() {
    setSaving(true);
    setError(null);

    const payload = {
      ...assetForm,
      directoryId: assetForm.directoryId ? Number(assetForm.directoryId) : null,
      tags: assetForm.tags
        .split(/[,，\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      sortOrder: Number(assetForm.sortOrder || 0)
    };

    try {
      if (editingAssetId) {
        await sendJson(`/api/admin/assets/${editingAssetId}`, "PUT", payload);
      } else {
        await sendJson("/api/admin/assets", "POST", payload);
      }
      setAssetForm(emptyAssetForm);
      setEditingAssetId(null);
      completeSave("应用已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "应用保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveRpaTask() {
    if (!editingRpaTaskId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await sendJson(`/api/admin/rpa-tasks/${encodeURIComponent(editingRpaTaskId)}`, "PUT", {
        requirementDocUrl: rpaTaskForm.requirementDocUrl
      });
      setRpaTaskForm(emptyRpaTaskForm);
      setEditingRpaTaskId(null);
      completeSave("RPA 任务已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "RPA 任务保存失败");
    } finally {
      setSaving(false);
    }
  }

  function editDirectory(directory: AdminDirectory) {
    setActiveTab("directories");
    setEditingDirectoryId(directory.id);
    setDirectoryForm({
      parentId: directory.parentId ? String(directory.parentId) : "",
      name: directory.name,
      description: directory.description ?? "",
      sortOrder: String(directory.sortOrder),
      status: directory.status
    });
  }

  function editAssetType(assetType: AdminAssetType) {
    setActiveTab("types");
    setEditingAssetTypeCode(assetType.code);
    setAssetTypeForm({
      code: assetType.code,
      name: assetType.name,
      description: assetType.description ?? "",
      color: assetType.color,
      icon: assetType.icon ?? "",
      sortOrder: String(assetType.sortOrder),
      status: assetType.status
    });
  }

  function editAsset(asset: AdminAsset) {
    setActiveTab("assets");
    setEditingAssetId(asset.id);
    setAssetForm({
      directoryId: String(asset.directoryId),
      type: asset.type,
      name: asset.name,
      description: asset.description ?? "",
      ownerName: asset.ownerName ?? "",
      departmentName: asset.departmentName ?? "",
      url: asset.url,
      tags: asset.tags.join(", "),
      sortOrder: String(asset.sortOrder),
      status: asset.status
    });
  }

  function editRpaTask(task: AdminRpaTask) {
    setActiveTab("rpaTasks");
    setEditingRpaTaskId(task.id);
    setRpaTaskForm({
      name: task.name,
      deptName: task.deptName,
      taskUuid: task.taskUuid ?? "",
      requirementDocUrl: task.requirementDocUrl ?? ""
    });
  }

  async function toggleDirectoryStatus(directory: AdminDirectory) {
    await sendJson(`/api/admin/directories/${directory.id}`, "PUT", {
      parentId: directory.parentId,
      name: directory.name,
      description: directory.description,
      sortOrder: directory.sortOrder,
      status: directory.status === "active" ? "inactive" : "active"
    });
    completeSave("目录状态已更新");
  }

  async function toggleAssetTypeStatus(assetType: AdminAssetType) {
    await sendJson(`/api/admin/asset-types/${encodeURIComponent(assetType.code)}`, "PUT", {
      code: assetType.code,
      name: assetType.name,
      description: assetType.description,
      color: assetType.color,
      icon: assetType.icon,
      sortOrder: assetType.sortOrder,
      status: assetType.status === "active" ? "inactive" : "active"
    });
    completeSave("应用类型状态已更新");
  }

  async function toggleAssetStatus(asset: AdminAsset) {
    await sendJson(`/api/admin/assets/${asset.id}`, "PUT", {
      directoryId: asset.directoryId,
      type: asset.type,
      name: asset.name,
      description: asset.description,
      ownerName: asset.ownerName,
      departmentName: asset.departmentName,
      url: asset.url,
      tags: asset.tags,
      sortOrder: asset.sortOrder,
      status: asset.status === "active" ? "inactive" : "active"
    });
    completeSave("应用状态已更新");
  }

  const directoryNameMap = useMemo(
    () => new Map(directories.map((directory) => [directory.id, directory.name])),
    [directories]
  );
  const typeNameMap = useMemo(
    () => new Map(assetTypes.map((assetType) => [assetType.code, assetType.name])),
    [assetTypes]
  );

  const parentDirectoryOptions = directories.filter((directory) => directory.id !== editingDirectoryId);

  return (
    <section className="adminConsole">
      <div className="adminHero">
        <div>
          <span>后台配置</span>
          <h1>管理后台</h1>
          <p>维护目录、应用和应用类型；启用状态会直接影响前台展示。</p>
        </div>
        <button className="secondaryButton" type="button" onClick={loadAdminData}>
          刷新
        </button>
      </div>

      <div className="adminTabs">
        <button className={activeTab === "assets" ? "active" : ""} type="button" onClick={() => setActiveTab("assets")}>
          应用管理
        </button>
        <button
          className={activeTab === "directories" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("directories")}
        >
          目录管理
        </button>
        <button className={activeTab === "types" ? "active" : ""} type="button" onClick={() => setActiveTab("types")}>
          应用类型
        </button>
        <button
          className={activeTab === "rpaTasks" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("rpaTasks")}
        >
          RPA任务
        </button>
      </div>

      {message ? <div className="adminNotice success">{message}</div> : null}
      {error ? <div className="adminNotice error">{error}</div> : null}

      {loading ? (
        <div className="adminSkeleton">
          <span />
          <span />
          <span />
        </div>
      ) : null}

      {!loading && activeTab === "assets" ? (
        <div className="adminGrid">
          <form className="adminCard adminForm" onSubmit={(event) => event.preventDefault()}>
            <div className="adminSectionHeader">
              <div>
                <h2>{editingAssetId ? "编辑应用" : "新增应用"}</h2>
                <p>支持维护名称、链接、标签、负责人和部门。</p>
              </div>
              {editingAssetId ? (
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => {
                    setEditingAssetId(null);
                    setAssetForm(emptyAssetForm);
                  }}
                >
                  取消编辑
                </button>
              ) : null}
            </div>

            <div className="formGrid">
              <label>
                应用名称
                <input value={assetForm.name} onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })} />
              </label>
              <label>
                应用类型
                <select value={assetForm.type} onChange={(event) => setAssetForm({ ...assetForm, type: event.target.value })}>
                  <option value="">请选择</option>
                  {assetTypes.map((assetType) => (
                    <option key={assetType.code} value={assetType.code}>
                      {assetType.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                所属目录
                <select
                  value={assetForm.directoryId}
                  onChange={(event) => setAssetForm({ ...assetForm, directoryId: event.target.value })}
                >
                  <option value="">请选择</option>
                  {directories.map((directory) => (
                    <option key={directory.id} value={directory.id}>
                      {directory.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                状态
                <select
                  value={assetForm.status}
                  onChange={(event) => setAssetForm({ ...assetForm, status: event.target.value as AdminStatus })}
                >
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
              <label>
                负责人
                <input
                  value={assetForm.ownerName}
                  onChange={(event) => setAssetForm({ ...assetForm, ownerName: event.target.value })}
                />
              </label>
              <label>
                部门
                <input
                  value={assetForm.departmentName}
                  onChange={(event) => setAssetForm({ ...assetForm, departmentName: event.target.value })}
                />
              </label>
              <label>
                排序
                <input
                  type="number"
                  value={assetForm.sortOrder}
                  onChange={(event) => setAssetForm({ ...assetForm, sortOrder: event.target.value })}
                />
              </label>
              <label>
                标签
                <input
                  value={assetForm.tags}
                  placeholder="多个标签用逗号分隔"
                  onChange={(event) => setAssetForm({ ...assetForm, tags: event.target.value })}
                />
              </label>
              <label className="wideField">
                应用链接
                <input value={assetForm.url} onChange={(event) => setAssetForm({ ...assetForm, url: event.target.value })} />
              </label>
              <label className="wideField">
                说明
                <textarea
                  value={assetForm.description}
                  onChange={(event) => setAssetForm({ ...assetForm, description: event.target.value })}
                />
              </label>
            </div>

            <button className="primaryButton" type="button" disabled={saving} onClick={saveAsset}>
              {saving ? "保存中..." : "保存应用"}
            </button>
          </form>

          <div className="adminCard adminList">
            <div className="adminSectionHeader">
              <div>
                <h2>应用列表</h2>
                <p>共 {assets.length} 个应用。</p>
              </div>
            </div>
            {assets.map((asset) => (
              <div className="adminRow" key={asset.id}>
                <div>
                  <strong>{asset.name}</strong>
                  <p>
                    {directoryNameMap.get(asset.directoryId) ?? "未找到目录"} · {typeNameMap.get(asset.type) ?? asset.type} ·{" "}
                    {asset.ownerName || "未填负责人"} · {asset.departmentName || "未填部门"}
                  </p>
                  <div className="tagLine">
                    {asset.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <span className={asset.status === "active" ? "statusBadge active" : "statusBadge inactive"}>
                  {asset.status === "active" ? "启用" : "停用"}
                </span>
                <div className="adminActions">
                  <button type="button" onClick={() => editAsset(asset)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => toggleAssetStatus(asset)}>
                    {asset.status === "active" ? "停用" : "启用"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && activeTab === "directories" ? (
        <div className="adminGrid">
          <form className="adminCard adminForm" onSubmit={(event) => event.preventDefault()}>
            <div className="adminSectionHeader">
              <div>
                <h2>{editingDirectoryId ? "编辑目录" : "新增目录"}</h2>
                <p>支持多级目录，停用后前台不会展示。</p>
              </div>
            </div>
            <div className="formGrid">
              <label>
                目录名称
                <input
                  value={directoryForm.name}
                  onChange={(event) => setDirectoryForm({ ...directoryForm, name: event.target.value })}
                />
              </label>
              <label>
                上级目录
                <select
                  value={directoryForm.parentId}
                  onChange={(event) => setDirectoryForm({ ...directoryForm, parentId: event.target.value })}
                >
                  <option value="">无，上级目录</option>
                  {parentDirectoryOptions.map((directory) => (
                    <option key={directory.id} value={directory.id}>
                      {directory.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                状态
                <select
                  value={directoryForm.status}
                  onChange={(event) => setDirectoryForm({ ...directoryForm, status: event.target.value as AdminStatus })}
                >
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
              <label>
                排序
                <input
                  type="number"
                  value={directoryForm.sortOrder}
                  onChange={(event) => setDirectoryForm({ ...directoryForm, sortOrder: event.target.value })}
                />
              </label>
              <label className="wideField">
                说明
                <textarea
                  value={directoryForm.description}
                  onChange={(event) => setDirectoryForm({ ...directoryForm, description: event.target.value })}
                />
              </label>
            </div>
            <div className="buttonRow">
              <button className="primaryButton" type="button" disabled={saving} onClick={saveDirectory}>
                {saving ? "保存中..." : "保存目录"}
              </button>
              {editingDirectoryId ? (
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => {
                    setEditingDirectoryId(null);
                    setDirectoryForm(emptyDirectoryForm);
                  }}
                >
                  取消编辑
                </button>
              ) : null}
            </div>
          </form>

          <div className="adminCard adminList">
            <div className="adminSectionHeader">
              <div>
                <h2>目录列表</h2>
                <p>共 {directories.length} 个目录。</p>
              </div>
            </div>
            {directories.map((directory) => (
              <div className="adminRow" key={directory.id}>
                <div>
                  <strong>{directory.name}</strong>
                  <p>
                    上级：{directory.parentId ? directoryNameMap.get(directory.parentId) ?? directory.parentId : "无"} · 排序：
                    {directory.sortOrder}
                  </p>
                </div>
                <span className={directory.status === "active" ? "statusBadge active" : "statusBadge inactive"}>
                  {directory.status === "active" ? "启用" : "停用"}
                </span>
                <div className="adminActions">
                  <button type="button" onClick={() => editDirectory(directory)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => toggleDirectoryStatus(directory)}>
                    {directory.status === "active" ? "停用" : "启用"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && activeTab === "types" ? (
        <div className="adminGrid">
          <form className="adminCard adminForm" onSubmit={(event) => event.preventDefault()}>
            <div className="adminSectionHeader">
              <div>
                <h2>{editingAssetTypeCode ? "编辑应用类型" : "新增应用类型"}</h2>
                <p>类型会影响前台筛选、统计卡片和标签样式。</p>
              </div>
            </div>
            <div className="formGrid">
              <label>
                类型编码
                <input
                  value={assetTypeForm.code}
                  disabled={Boolean(editingAssetTypeCode)}
                  onChange={(event) => setAssetTypeForm({ ...assetTypeForm, code: event.target.value })}
                />
              </label>
              <label>
                类型名称
                <input
                  value={assetTypeForm.name}
                  onChange={(event) => setAssetTypeForm({ ...assetTypeForm, name: event.target.value })}
                />
              </label>
              <label>
                颜色
                <select
                  value={assetTypeForm.color}
                  onChange={(event) => setAssetTypeForm({ ...assetTypeForm, color: event.target.value })}
                >
                  <option value="green">绿色</option>
                  <option value="blue">蓝色</option>
                  <option value="purple">紫色</option>
                  <option value="orange">橙色</option>
                  <option value="gray">灰色</option>
                </select>
              </label>
              <label>
                图标
                <input
                  value={assetTypeForm.icon}
                  placeholder="table / workflow / link"
                  onChange={(event) => setAssetTypeForm({ ...assetTypeForm, icon: event.target.value })}
                />
              </label>
              <label>
                状态
                <select
                  value={assetTypeForm.status}
                  onChange={(event) => setAssetTypeForm({ ...assetTypeForm, status: event.target.value as AdminStatus })}
                >
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
              <label>
                排序
                <input
                  type="number"
                  value={assetTypeForm.sortOrder}
                  onChange={(event) => setAssetTypeForm({ ...assetTypeForm, sortOrder: event.target.value })}
                />
              </label>
              <label className="wideField">
                说明
                <textarea
                  value={assetTypeForm.description}
                  onChange={(event) => setAssetTypeForm({ ...assetTypeForm, description: event.target.value })}
                />
              </label>
            </div>
            <div className="buttonRow">
              <button className="primaryButton" type="button" disabled={saving} onClick={saveAssetType}>
                {saving ? "保存中..." : "保存类型"}
              </button>
              {editingAssetTypeCode ? (
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => {
                    setEditingAssetTypeCode(null);
                    setAssetTypeForm(emptyAssetTypeForm);
                  }}
                >
                  取消编辑
                </button>
              ) : null}
            </div>
          </form>

          <div className="adminCard adminList">
            <div className="adminSectionHeader">
              <div>
                <h2>类型列表</h2>
                <p>共 {assetTypes.length} 个类型。</p>
              </div>
            </div>
            {assetTypes.map((assetType) => (
              <div className="adminRow" key={assetType.code}>
                <div>
                  <strong>{assetType.name}</strong>
                  <p>
                    {assetType.code} · {assetType.color} · 排序：{assetType.sortOrder}
                  </p>
                </div>
                <span className={assetType.status === "active" ? "statusBadge active" : "statusBadge inactive"}>
                  {assetType.status === "active" ? "启用" : "停用"}
                </span>
                <div className="adminActions">
                  <button type="button" onClick={() => editAssetType(assetType)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => toggleAssetTypeStatus(assetType)}>
                    {assetType.status === "active" ? "停用" : "启用"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && activeTab === "rpaTasks" ? (
        <div className="adminGrid">
          <form className="adminCard adminForm" onSubmit={(event) => event.preventDefault()}>
            <div className="adminSectionHeader">
              <div>
                <h2>{editingRpaTaskId ? "编辑 RPA 任务" : "选择 RPA 任务"}</h2>
                <p>仅维护需求文档链接，任务名称、部门和 UUID 为只读。</p>
              </div>
            </div>
            <div className="formGrid">
              <label>
                任务名称
                <input value={rpaTaskForm.name} disabled />
              </label>
              <label>
                所属部门
                <input value={rpaTaskForm.deptName} disabled />
              </label>
              <label className="wideField">
                task_uuid
                <input value={rpaTaskForm.taskUuid} disabled />
              </label>
              <label className="wideField">
                需求文档链接
                <input
                  value={rpaTaskForm.requirementDocUrl}
                  placeholder="https://..."
                  onChange={(event) =>
                    setRpaTaskForm({ ...rpaTaskForm, requirementDocUrl: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="buttonRow">
              <button
                className="primaryButton"
                type="button"
                disabled={saving || !editingRpaTaskId}
                onClick={saveRpaTask}
              >
                {saving ? "保存中..." : "保存需求文档"}
              </button>
              {editingRpaTaskId ? (
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => {
                    setEditingRpaTaskId(null);
                    setRpaTaskForm(emptyRpaTaskForm);
                  }}
                >
                  取消编辑
                </button>
              ) : null}
            </div>
          </form>

          <div className="adminCard adminList">
            <div className="adminSectionHeader">
              <div>
                <h2>RPA 任务列表</h2>
                <p>共 {rpaTasks.length} 个任务。</p>
              </div>
            </div>
            {rpaTasks.map((task) => (
              <div className="adminRow" key={task.id}>
                <div>
                  <strong>{task.name}</strong>
                  <p>
                    {task.deptName} · {task.taskUuid ?? "未配置 task_uuid"} · {task.ownerName || "未填负责人"}
                  </p>
                  <div className="tagLine">
                    <span>{task.status || "未填写状态"}</span>
                    <span>{task.requirementDocUrl ? "已配置需求文档" : "未配置需求文档"}</span>
                  </div>
                </div>
                <span className={task.requirementDocUrl ? "statusBadge active" : "statusBadge inactive"}>
                  {task.requirementDocUrl ? "已配置" : "待补充"}
                </span>
                <div className="adminActions">
                  <button type="button" onClick={() => editRpaTask(task)}>
                    编辑
                  </button>
                  {task.requirementDocUrl ? (
                    <a
                      className="secondaryButton adminLinkButton"
                      href={task.requirementDocUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开文档
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function AssetPortal() {
  const [directories, setDirectories] = useState<ApiState<Directory[]>>({
    data: [],
    loading: true,
    error: null
  });
  const [assets, setAssets] = useState<ApiState<Asset[]>>({
    data: [],
    loading: true,
    error: null
  });
  const [assetTypes, setAssetTypes] = useState<ApiState<AssetTypeDefinition[]>>({
    data: [],
    loading: true,
    error: null
  });
  const [stats, setStats] = useState<ApiState<AssetStats>>({
    data: defaultStats,
    loading: true,
    error: null
  });
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [reportAssets, setReportAssets] = useState<ApiState<Asset[]>>({
    data: [],
    loading: true,
    error: null
  });
  const [rpaTasks, setRpaTasks] = useState<ApiState<RpaTask[]>>({
    data: [],
    loading: true,
    error: null
  });
  const [rpaRunRecords, setRpaRunRecords] = useState<ApiState<RpaRunRecord[]>>({
    data: [],
    loading: true,
    error: null
  });
  const [activeView, setActiveView] = useState<ActiveView>("home");
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<number | null>(null);
  const [selectedRpaDept, setSelectedRpaDept] = useState<string | null>(null);
  const [selectedRpaLogTask, setSelectedRpaLogTask] = useState<RpaTask | null>(null);
  const [rpaKeyword, setRpaKeyword] = useState("");
  const [selectedRpaStatus, setSelectedRpaStatus] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [favoriteAssetIds, setFavoriteAssetIds] = useState<Set<number>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [favoritePendingIds, setFavoritePendingIds] = useState<Set<number>>(new Set());
  const [collapsedDirectoryIds, setCollapsedDirectoryIds] = useState<Set<number>>(new Set());
  const [rpaCollapsed, setRpaCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statsStartDate, setStatsStartDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [statsEndDate, setStatsEndDate] = useState("");
  const [statsType, setStatsType] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<SessionUser | null>("/api/auth/me")
      .then((data) => setCurrentUser(data))
      .catch(() => setCurrentUser(null));

    fetchJson<Directory[]>("/api/directories")
      .then((data) => setDirectories({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setDirectories({ data: [], loading: false, error: error.message })
      );
  }, []);

  useEffect(() => {
    fetchJson<AssetTypeDefinition[]>("/api/asset-types")
      .then((data) => setAssetTypes({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setAssetTypes({ data: [], loading: false, error: error.message })
      );
  }, []);

  useEffect(() => {
    fetchJson<RpaTask[]>("/api/rpa/tasks")
      .then((data) => setRpaTasks({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setRpaTasks({ data: [], loading: false, error: error.message })
      );

    fetchJson<RpaRunRecord[]>("/api/rpa/run-records?limit=300")
      .then((data) => setRpaRunRecords({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setRpaRunRecords({ data: [], loading: false, error: error.message })
      );
  }, []);

  useEffect(() => {
    const statsParams = new URLSearchParams();
    if (statsStartDate) {
      statsParams.set("startDate", statsStartDate);
    }
    if (statsEndDate) {
      statsParams.set("endDate", statsEndDate);
    }
    if (statsType) {
      statsParams.set("type", statsType);
    }
    const statsUrl = `/api/stats?${statsParams.toString()}`;

    fetchJson<AssetStats>(statsUrl)
      .then((data) => setStats({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setStats({ data: defaultStats, loading: false, error: error.message })
      );
  }, [statsStartDate, statsEndDate, statsType]);

  useEffect(() => {
    if (activeView === "stats" || activeView === "admin" || activeView === "rpa" || activeView === "rpaLogs") {
      return;
    }

    const params = new URLSearchParams();
    if (selectedDirectoryId) {
      params.set("directoryId", String(selectedDirectoryId));
    }
    if (selectedType) {
      params.set("type", selectedType);
    }
    if (keyword.trim()) {
      params.set("keyword", keyword.trim());
    }

    setAssets((current) => ({ ...current, loading: true, error: null }));
    fetchJson<Asset[]>(`/api/assets?${params.toString()}`)
      .then((data) => setAssets({ data, loading: false, error: null }))
      .catch((error: Error) => setAssets({ data: [], loading: false, error: error.message }));
  }, [activeView, selectedDirectoryId, selectedType, keyword]);

  useEffect(() => {
    if (activeView !== "stats") {
      return;
    }

    const params = new URLSearchParams();
    if (statsType) {
      params.set("type", statsType);
    }

    fetchJson<Asset[]>(`/api/assets${params.toString() ? `?${params.toString()}` : ""}`)
      .then((data) => setReportAssets((current) => ({ ...current, data, loading: false, error: null })))
      .catch((error: Error) =>
        setReportAssets((current) => ({ ...current, loading: false, error: error.message }))
      );
  }, [activeView, statsType]);

  const directoryTree = useMemo(() => buildDirectoryTree(directories.data), [directories.data]);
  const selectedDirectory = useMemo(
    () => directories.data.find((directory) => directory.id === selectedDirectoryId),
    [directories.data, selectedDirectoryId]
  );
  const assetTypeMap = useMemo(() => {
    return new Map(assetTypes.data.map((assetType) => [assetType.code, assetType]));
  }, [assetTypes.data]);
  const favoriteAssets = useMemo(() => {
    return assets.data.filter((asset) => favoriteAssetIds.has(asset.id));
  }, [assets.data, favoriteAssetIds]);
  const rpaDepartments = useMemo(() => {
    return Array.from(new Set(rpaTasks.data.map((task) => task.deptName))).sort((left, right) =>
      left.localeCompare(right, "zh-Hans-CN")
    );
  }, [rpaTasks.data]);
  const rpaStatuses = useMemo(() => {
    return Array.from(
      new Set(rpaTasks.data.map((task) => task.status?.trim()).filter((status): status is string => Boolean(status)))
    ).sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  }, [rpaTasks.data]);
  const filteredRpaTasks = useMemo(() => {
    const normalizedKeyword = rpaKeyword.trim().toLowerCase();

    return rpaTasks.data.filter((task) => {
      if (selectedRpaDept && task.deptName !== selectedRpaDept) {
        return false;
      }

      if (selectedRpaStatus && (task.status ?? "") !== selectedRpaStatus) {
        return false;
      }

      if (normalizedKeyword && !task.name.toLowerCase().includes(normalizedKeyword)) {
        return false;
      }

      return true;
    });
  }, [rpaTasks.data, selectedRpaDept, selectedRpaStatus, rpaKeyword]);
  const selectedRpaLogRecords = useMemo(() => {
    if (!selectedRpaLogTask?.taskUuid) {
      return [];
    }

    return rpaRunRecords.data.filter((record) => record.taskUuid === selectedRpaLogTask.taskUuid);
  }, [rpaRunRecords.data, selectedRpaLogTask]);

  useEffect(() => {
    if (!currentUser) {
      setFavoriteAssetIds(new Set());
      setFavoritesLoaded(true);
      return;
    }

    setFavoritesLoaded(false);
    fetchFavoriteAssetIds()
      .then((assetIds) => setFavoriteAssetIds(new Set(assetIds)))
      .catch(() => setFavoriteAssetIds(new Set()))
      .finally(() => setFavoritesLoaded(true));
  }, [currentUser?.id]);

  function toggleDirectory(directoryId: number) {
    setCollapsedDirectoryIds((current) => {
      const next = new Set(current);
      if (next.has(directoryId)) {
        next.delete(directoryId);
      } else {
        next.add(directoryId);
      }
      return next;
    });
  }

  function openHome() {
    setActiveView("home");
    setSelectedDirectoryId(null);
  }

  function openDirectory(directoryId: number) {
    setActiveView("directory");
    setSelectedDirectoryId(directoryId);
  }

  function openStats() {
    setActiveView("stats");
    setSelectedDirectoryId(null);
  }

  function openFavorites() {
    setActiveView("favorites");
    setSelectedDirectoryId(null);
  }

  function openRpa(deptName: string | null = null) {
    setActiveView("rpa");
    setSelectedDirectoryId(null);
    setSelectedRpaDept(deptName);
    setSelectedRpaLogTask(null);
  }

  function resetRpaFilters() {
    setRpaKeyword("");
    setSelectedRpaDept(null);
    setSelectedRpaStatus(null);
  }

  function openRpaLogs(task: RpaTask) {
    setActiveView("rpaLogs");
    setSelectedDirectoryId(null);
    setSelectedRpaLogTask(task);
  }

  function openAdmin() {
    setActiveView("admin");
    setSelectedDirectoryId(null);
  }

  async function toggleFavoriteAsset(assetId: number) {
    if (favoritePendingIds.has(assetId)) {
      return;
    }

    const wasFavorite = favoriteAssetIds.has(assetId);

    setFavoritePendingIds((current) => new Set(current).add(assetId));
    setFavoriteAssetIds((current) => {
      const next = new Set(current);
      if (wasFavorite) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });

    try {
      if (wasFavorite) {
        await removeFavoriteAsset(assetId);
      } else {
        await addFavoriteAsset(assetId);
      }
    } catch {
      setFavoriteAssetIds((current) => {
        const next = new Set(current);
        if (wasFavorite) {
          next.add(assetId);
        } else {
          next.delete(assetId);
        }
        return next;
      });
    } finally {
      setFavoritePendingIds((current) => {
        const next = new Set(current);
        next.delete(assetId);
        return next;
      });
    }
  }

  function refreshPortalData() {
    fetchJson<Directory[]>("/api/directories")
      .then((data) => setDirectories({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setDirectories({ data: [], loading: false, error: error.message })
      );
    fetchJson<AssetTypeDefinition[]>("/api/asset-types")
      .then((data) => setAssetTypes({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setAssetTypes({ data: [], loading: false, error: error.message })
      );
    fetchJson<AssetStats>("/api/stats")
      .then((data) => setStats({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setStats({ data: defaultStats, loading: false, error: error.message })
      );
  }

  function resetStatsDateRange() {
    setStatsStartDate("");
    setStatsEndDate("");
  }

  async function logout() {
    await fetch(withBasePath("/api/auth/logout"), { method: "POST", credentials: "include" }).catch(
      () => undefined
    );
    window.location.href = withBasePath("/login");
  }

  return (
    <main className={sidebarCollapsed ? "appShell sidebarIsCollapsed" : "appShell"}>
      <aside className="sidebar">
        <div className="brandRow">
          <div className="brandMark">徽</div>
          <strong>华徽智能工作台</strong>
          <button
            className="iconButton"
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {sidebarCollapsed ? "»" : "«"}
          </button>
        </div>

        <button
          className={activeView === "home" ? "homeNav active" : "homeNav"}
          type="button"
          onClick={openHome}
        >
          <span>⌂</span>
          <strong>工作台</strong>
        </button>

        <button
          className={activeView === "favorites" ? "homeNav active" : "homeNav"}
          type="button"
          onClick={openFavorites}
        >
          <span>★</span>
          <strong>{`我的收藏${favoriteAssetIds.size > 0 ? ` (${favoriteAssetIds.size})` : ""}`}</strong>
        </button>

        <button
          className={activeView === "stats" ? "homeNav active" : "homeNav"}
          type="button"
          onClick={openStats}
        >
          <span>▥</span>
          <strong>统计报表</strong>
        </button>
        {currentUser?.isAdmin ? (
          <button
            className={activeView === "admin" ? "homeNav active" : "homeNav"}
            type="button"
            onClick={openAdmin}
          >
            <span>⚙</span>
            <strong>管理后台</strong>
          </button>
        ) : null}

        <div className="navGroup">
          <div className={activeView === "rpa" ? "parentNav active" : "parentNav"}>
            <button
              className="collapseControl"
              type="button"
              onClick={() => setRpaCollapsed((value) => !value)}
              title={rpaCollapsed ? "展开实在RPA" : "收起实在RPA"}
            >
              {rpaCollapsed ? "▸" : "▾"}
            </button>
            <button className="parentLabel" type="button" onClick={() => openRpa(null)}>
              <span>▣</span>
              <strong>实在RPA</strong>
            </button>
          </div>

          {!rpaCollapsed ? (
            <div className="childNavList">
              {rpaTasks.loading ? <p className="navState">RPA 加载中...</p> : null}
              {rpaTasks.error ? <p className="errorText">{rpaTasks.error}</p> : null}
              {rpaDepartments.map((deptName) => (
                <div className="parentNav" key={deptName}>
                  <button className="collapseControl" type="button" onClick={() => openRpa(deptName)}>
                    ·
                  </button>
                  <button
                    className="parentLabel"
                    type="button"
                    onClick={() => openRpa(deptName)}
                  >
                    <span>□</span>
                    <strong>{deptName}</strong>
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="directoryNav" aria-label="资产目录">
          {directories.loading ? <p className="navState">目录加载中...</p> : null}
          {directories.error ? <p className="errorText">{directories.error}</p> : null}

          {directoryTree.map((directory) => (
            <DirectoryTreeItem
              key={directory.id}
              node={directory}
              selectedDirectoryId={selectedDirectoryId}
              collapsedDirectoryIds={collapsedDirectoryIds}
              onSelect={openDirectory}
              onToggle={toggleDirectory}
            />
          ))}
        </nav>
      </aside>

      <section className="contentShell">
        <div className="topBar">
          {currentUser ? (
            <div className="userMenuBar">
              <div className="userMenu">
                <button
                  className="userMenuTrigger"
                  type="button"
                  onClick={() => setUserMenuOpen((value) => !value)}
                  aria-expanded={userMenuOpen}
                >
                  <span className="userAvatar">人</span>
                  <strong>{currentUser.name}</strong>
                </button>
                {userMenuOpen ? (
                  <div className="userMenuDropdown">
                    <div className="userMenuMeta">
                      <span>{currentUser.departmentName ?? "未填写部门"}</span>
                      <span>{currentUser.email ?? "未填写邮箱"}</span>
                    </div>
                  </div>
                ) : null}
              </div>
              <button className="topLogoutButton" type="button" onClick={logout}>
                退出登录
              </button>
            </div>
          ) : null}
        </div>

        {activeView === "rpaLogs" && selectedRpaLogTask ? (
          <RpaLogPanel
            task={selectedRpaLogTask}
            records={selectedRpaLogRecords}
            loading={rpaRunRecords.loading}
            error={rpaRunRecords.error}
            onBack={() => openRpa(selectedRpaLogTask.deptName)}
          />
        ) : activeView === "rpa" ? (
          <RpaTaskPanel
            tasks={filteredRpaTasks}
            departments={rpaDepartments}
            statuses={rpaStatuses}
            selectedDept={selectedRpaDept}
            keyword={rpaKeyword}
            selectedStatus={selectedRpaStatus}
            loading={rpaTasks.loading}
            error={rpaTasks.error}
            onKeywordChange={setRpaKeyword}
            onSelectDept={setSelectedRpaDept}
            onSelectStatus={setSelectedRpaStatus}
            onResetFilters={resetRpaFilters}
            onViewLogs={openRpaLogs}
          />
        ) : activeView === "admin" && currentUser?.isAdmin ? (
          <AdminPanel onDataChanged={refreshPortalData} />
        ) : activeView === "stats" ? (
          <EnhancedStatsReport
            assets={reportAssets.data}
            stats={stats.data}
            startDate={statsStartDate}
            endDate={statsEndDate}
            onStartDateChange={setStatsStartDate}
            onEndDateChange={setStatsEndDate}
            onResetDateRange={resetStatsDateRange}
            loading={reportAssets.loading || stats.loading}
            error={reportAssets.error ?? stats.error}
            assetTypeMap={assetTypeMap}
            assetTypes={assetTypes.data}
            statsType={statsType}
            onStatsTypeChange={setStatsType}
            favoriteAssetIds={favoriteAssetIds}
            favoritePendingIds={favoritePendingIds}
            onToggleFavorite={toggleFavoriteAsset}
          />
        ) : activeView === "favorites" ? (
          <>
            <section className="detailHeader">
              <div>
                <h1>我的收藏</h1>
                <span>这里展示当前登录用户收藏的应用入口。</span>
              </div>
            </section>

            <TypeFilterBar
              assetTypes={assetTypes.data}
              selectedType={selectedType}
              onSelectType={setSelectedType}
            />

            <AssetListPanel
              title="收藏应用"
              description="仅显示你已收藏的应用"
              keyword={keyword}
              onKeywordChange={setKeyword}
              assets={favoriteAssets}
              loading={assets.loading && !favoritesLoaded}
              error={assets.error}
              assetTypeMap={assetTypeMap}
              favoriteAssetIds={favoriteAssetIds}
              favoritePendingIds={favoritePendingIds}
              onToggleFavorite={toggleFavoriteAsset}
            />
          </>
        ) : selectedDirectoryId === null ? (
          <>
            <section className="banner">
              <div>
                <h1>华徽智能工作台</h1>
                <span>
                  统一汇总飞书多维表与智能体等应用入口，让团队成员快速找到业务系统、流程和资料。
                </span>
              </div>
              <strong>信息系统部</strong>
            </section>

            <TypeFilterBar
              assetTypes={assetTypes.data}
              selectedType={selectedType}
              onSelectType={setSelectedType}
            />

            <section className="dashboardGrid">
              <section className="mainPanel">
                <div className="metricGrid">
                  <div className="metricCard">
                    <span>启用目录</span>
                    <strong>{stats.data.directoryCount || directories.data.length}</strong>
                  </div>
                  <div className="metricCard">
                    <span>全部应用</span>
                    <strong>{stats.data.assetCount || assets.data.length}</strong>
                  </div>
                  {stats.data.typeStats.slice(0, 4).map((typeStat) => (
                    <div className="metricCard" key={typeStat.code}>
                      <span>{typeStat.name}</span>
                      <strong>{typeStat.count}</strong>
                    </div>
                  ))}
                </div>

                <AssetListPanel
                  title="全部应用"
                  description="当前可访问的全部应用"
                  keyword={keyword}
                  onKeywordChange={setKeyword}
                  assets={assets.data}
                  loading={assets.loading}
                  error={assets.error}
                  assetTypeMap={assetTypeMap}
                  favoriteAssetIds={favoriteAssetIds}
                  favoritePendingIds={favoritePendingIds}
                  onToggleFavorite={toggleFavoriteAsset}
                />
              </section>

              <aside className="rightRail">
                <div className="countdownCard">
                  <h2>入口详情</h2>
                  <div className="countdownGrid">
                    <strong>{stats.data.directoryCount || directories.data.length}</strong>
                    <strong>{stats.data.assetCount || assets.data.length}</strong>
                    <strong>{assetTypes.data.length}</strong>
                  </div>
                  <div className="countdownLabels">
                    <span>目录</span>
                    <span>应用</span>
                    <span>类型</span>
                  </div>
                </div>

                <div className="sidePanel">
                  <div className="panelTitleRow compact">
                    <h2>应用推荐</h2>
                    <span>{assets.data.length} 条</span>
                  </div>
                  <div className="miniList">
                    {assets.data.slice(0, 6).map((asset, index) => (
                      <div className="miniListItem" key={asset.id}>
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => recordAssetOpen(asset.id)}
                        >
                          <span>{index + 1}</span>
                          <strong>{asset.name}</strong>
                          <em>{assetTypeMap.get(asset.type)?.name ?? asset.type}</em>
                        </a>
                        <FavoriteToggleButton
                          active={favoriteAssetIds.has(asset.id)}
                          disabled={favoritePendingIds.has(asset.id)}
                          onToggle={() => toggleFavoriteAsset(asset.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </section>
          </>
        ) : (
          <section className="directoryDetail">
            <div className="detailHeader">
              <div>
                <h1>{selectedDirectory?.name ?? "目录详情"}</h1>
                <span>{selectedDirectory?.description ?? "当前目录及其子目录下的全部应用入口"}</span>
              </div>
            </div>

            <TypeFilterBar
              assetTypes={assetTypes.data}
              selectedType={selectedType}
              onSelectType={setSelectedType}
            />

            <AssetListPanel
              title="应用入口"
              description={`当前目录及子目录下共 ${assets.data.length} 个应用`}
              keyword={keyword}
              onKeywordChange={setKeyword}
              assets={assets.data}
              loading={assets.loading}
              error={assets.error}
              assetTypeMap={assetTypeMap}
              favoriteAssetIds={favoriteAssetIds}
              favoritePendingIds={favoritePendingIds}
              onToggleFavorite={toggleFavoriteAsset}
            />
          </section>
        )}
      </section>
    </main>
  );
}
