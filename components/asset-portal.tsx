"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Asset,
  AssetStats,
  AssetTypeDefinition,
  Directory,
  EipDepartmentReference,
  EipUserReference,
  QuickServiceCard,
  QuickServiceGroup
} from "@/types/assets";
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

type ActiveView = "home" | "quickServices" | "directory" | "favorites" | "stats" | "admin" | "rpa" | "rpaLogs";

type RpaTask = {
  id: string;
  taskUuid: string | null;
  deptName: string;
  name: string;
  description: string | null;
  ownerName: string | null;
  requirementDocUrl: string | null;
  relatedMaterialUrl: string | null;
  status: "启用" | "禁用" | "不存在";
  createdAt: string | null;
  scheduleDescription: string;
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

type RpaRunRecordPage = {
  items: RpaRunRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const assetListPageSize = 10;
const rpaTaskPageSize = 10;
const rpaTaskStatusOrder: RpaTask["status"][] = ["启用", "禁用", "不存在"];

type AdminStatus = "active" | "inactive";

type AdminDirectory = Directory & {
  status: AdminStatus;
};

type AdminDirectoryNode = AdminDirectory & {
  children: AdminDirectoryNode[];
};

type AdminAssetType = AssetTypeDefinition & {
  status: AdminStatus;
};

type AdminAsset = Asset & {
  status: AdminStatus;
};

type AdminQuickServiceCard = QuickServiceCard & {
  status: AdminStatus;
};

type AdminQuickServiceGroup = Omit<QuickServiceGroup, "cards"> & {
  status: AdminStatus;
  cards: AdminQuickServiceCard[];
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
  ownerWorkcode: string;
  departmentIds: string[];
  url: string;
  openMode: Asset["openMode"];
  tags: string;
  sortOrder: string;
  status: AdminStatus;
};

type QuickServiceGroupFormState = {
  name: string;
  description: string;
  sortOrder: string;
  status: AdminStatus;
};

type QuickServiceCardFormState = {
  groupId: string;
  name: string;
  description: string;
  url: string;
  openMode: Asset["openMode"];
  icon: string;
  color: string;
  sortOrder: string;
  status: AdminStatus;
};

type AdminRpaTask = {
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

type RpaTaskFormState = {
  name: string;
  deptName: string;
  taskUuid: string;
  requirementDocUrl: string;
  relatedMaterialUrl: string;
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

function getAssetLinkProps(openMode: Asset["openMode"]) {
  return openMode === "new_tab" ? { target: "_blank", rel: "noreferrer" as const } : {};
}

function isHttpUrl(value: string | null | undefined): value is string {
  return /^https?:\/\/\S+$/i.test(value?.trim() ?? "");
}

function RpaReferenceValue({ value }: { value: string | null }) {
  const displayValue = value?.trim();

  if (!displayValue) {
    return <span className="rpaReferenceEmpty">无</span>;
  }

  if (isHttpUrl(displayValue)) {
    return (
      <a className="assetNameLink inlineLink" href={displayValue} target="_blank" rel="noreferrer">
        查看链接
      </a>
    );
  }

  return (
    <span className="rpaReferenceText" tabIndex={0}>
      <span className="rpaReferenceTextPreview">{displayValue}</span>
      <span className="rpaReferenceTooltip" role="tooltip">
        {displayValue}
      </span>
    </span>
  );
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
  window.dispatchEvent(new CustomEvent("asset-opened", { detail: assetId }));
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

function collectCollapsibleDirectoryIds(nodes: DirectoryNode[]): number[] {
  const ids: number[] = [];

  nodes.forEach((node) => {
    if (node.children.length > 0) {
      ids.push(node.id);
      ids.push(...collectCollapsibleDirectoryIds(node.children));
    }
  });

  return ids;
}

function DirectoryTreeItem({
  node,
  selectedDirectoryId,
  collapsedDirectoryIds,
  onSelect,
  onToggle,
  depth = 0
}: {
  node: DirectoryNode;
  selectedDirectoryId: number | null;
  collapsedDirectoryIds: Set<number>;
  onSelect: (directoryId: number) => void;
  onToggle: (directoryId: number) => void;
  depth?: number;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsedDirectoryIds.has(node.id);
  const isActive = selectedDirectoryId === node.id;

  return (
    <div className="navGroup">
      <div className={`${isActive ? "parentNav active" : "parentNav"} ${depth === 0 ? "sidebarTreeRoot" : "sidebarTreeChild"}`}>
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
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuickServiceGroups({
  groups,
  loading,
  error
}: {
  groups: QuickServiceGroup[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <p className="quickServiceState">快捷服务加载中...</p>;
  if (error) return <p className="quickServiceState errorText">{error}</p>;
  if (groups.length === 0) return <p className="quickServiceState">暂无可用的快捷服务</p>;

  return (
    <div className="quickServiceGroups">
      {groups.map((group) => (
        <section className="quickServiceGroup" key={group.id}>
          <div className="quickServiceGroupHeading">
            <div>
              <h3>{group.name}</h3>
              <p>{group.description || `共 ${group.cards.length} 个快捷入口`}</p>
            </div>
            <span>{group.cards.length}</span>
          </div>
          <div className="quickServiceCardGrid">
            {group.cards.map((card) => {
              return (
                <a
                  className="quickServiceCard"
                  href={card.url}
                  key={card.id}
                  {...getAssetLinkProps(card.openMode)}
                >
                  <span className={`quickServiceIcon ${getTypeColorClass(card.color)}`}>
                    {getTypeIcon(card.icon)}
                  </span>
                  <span className="quickServiceCopy">
                    <strong>{card.name}</strong>
                    <em>{card.description || "点击进入服务页面"}</em>
                  </span>
                  <i>立即填写&nbsp;›</i>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function buildAdminDirectoryTree(directories: AdminDirectory[]): AdminDirectoryNode[] {
  const nodeMap = new Map<number, AdminDirectoryNode>();
  const roots: AdminDirectoryNode[] = [];

  directories.forEach((directory) => {
    nodeMap.set(directory.id, { ...directory, children: [] });
  });

  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: AdminDirectoryNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

function filterAdminDirectoryTree(nodes: AdminDirectoryNode[], keyword: string): AdminDirectoryNode[] {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const children = filterAdminDirectoryTree(node.children, normalizedKeyword);
    if (node.name.toLowerCase().includes(normalizedKeyword) || children.length > 0) {
      return [{ ...node, children }];
    }
    return [];
  });
}

function DirectoryPickerNode({
  node,
  selectedId,
  collapsedIds,
  disabledIds,
  forceExpanded,
  onToggle,
  onSelect
}: {
  node: AdminDirectoryNode;
  selectedId: number | null;
  collapsedIds: Set<number>;
  disabledIds: Set<number>;
  forceExpanded: boolean;
  onToggle: (directoryId: number) => void;
  onSelect: (directory: AdminDirectoryNode) => void;
}) {
  const hasChildren = node.children.length > 0;
  const collapsed = !forceExpanded && collapsedIds.has(node.id);
  const disabled = disabledIds.has(node.id);

  return (
    <div className="directoryPickerBranch">
      <div className={`directoryPickerRow${selectedId === node.id ? " selected" : ""}${disabled ? " disabled" : ""}`}>
        <button
          className="directoryPickerToggle"
          type="button"
          disabled={!hasChildren}
          onClick={() => onToggle(node.id)}
          aria-label={hasChildren ? (collapsed ? `展开${node.name}` : `收起${node.name}`) : undefined}
        >
          {hasChildren ? (collapsed ? "›" : "⌄") : "·"}
        </button>
        <button
          className="directoryPickerName"
          type="button"
          disabled={disabled}
          onClick={() => onSelect(node)}
        >
          <span aria-hidden="true">{hasChildren ? "▣" : "□"}</span>
          <strong>{node.name}</strong>
          {node.status === "inactive" ? <em>已停用</em> : null}
        </button>
      </div>
      {!collapsed && hasChildren ? (
        <div className="directoryPickerChildren">
          {node.children.map((child) => (
            <DirectoryPickerNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              collapsedIds={collapsedIds}
              disabledIds={disabledIds}
              forceExpanded={forceExpanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DirectoryTreePicker({
  directories,
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = "请选择目录",
  disabledIds = new Set<number>()
}: {
  directories: AdminDirectory[];
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabledIds?: Set<number>;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const tree = useMemo(() => buildAdminDirectoryTree(directories), [directories]);
  const filteredTree = useMemo(() => filterAdminDirectoryTree(tree, keyword), [tree, keyword]);
  const selectedId = value ? Number(value) : null;
  const directoryPathMap = useMemo(() => {
    const directoryMap = new Map(directories.map((directory) => [directory.id, directory]));
    return new Map(
      directories.map((directory) => {
        const path = [directory.name];
        const visited = new Set([directory.id]);
        let parentId = directory.parentId;
        while (parentId && directoryMap.has(parentId) && !visited.has(parentId)) {
          visited.add(parentId);
          const parent = directoryMap.get(parentId);
          if (!parent) break;
          path.unshift(parent.name);
          parentId = parent.parentId;
        }
        return [directory.id, path.join(" / ")] as const;
      })
    );
  }, [directories]);

  function toggleDirectory(directoryId: number) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(directoryId)) next.delete(directoryId);
      else next.add(directoryId);
      return next;
    });
  }

  return (
    <div className={`directoryTreePicker${open ? " open" : ""}`}>
      <button
        className="directoryTreePickerTrigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>{selectedId ? directoryPathMap.get(selectedId) ?? "目录不存在" : emptyLabel}</span>
        <i aria-hidden="true">{open ? "⌃" : "⌄"}</i>
      </button>
      {open ? (
        <div className="directoryTreePickerPanel">
          <div className="directoryTreePickerSearch">
            <span aria-hidden="true">⌕</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索目录"
              autoFocus
            />
          </div>
          <div className="directoryTreePickerList">
            {allowEmpty ? (
              <button
                className={`directoryPickerEmpty${selectedId === null ? " selected" : ""}`}
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <span aria-hidden="true">⌂</span>
                {emptyLabel}
              </button>
            ) : null}
            {filteredTree.map((node) => (
              <DirectoryPickerNode
                key={node.id}
                node={node}
                selectedId={selectedId}
                collapsedIds={collapsedIds}
                disabledIds={disabledIds}
                forceExpanded={Boolean(keyword.trim())}
                onToggle={toggleDirectory}
                onSelect={(directory) => {
                  onChange(String(directory.id));
                  setOpen(false);
                  setKeyword("");
                }}
              />
            ))}
            {filteredTree.length === 0 ? <p className="directoryPickerNoResult">没有匹配的目录</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ReferenceSelectOption = {
  value: string;
  label: string;
  description?: string | null;
};

function ReferenceSearchSelect({
  options,
  selectedValues,
  onChange,
  placeholder,
  searchPlaceholder,
  multiple = false
}: {
  options: ReferenceSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const optionMap = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
  const filteredOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""}`.toLowerCase().includes(keyword)
    );
  }, [options, query]);
  const selectedOptions = selectedValues.flatMap((value) => optionMap.get(value) ?? []);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function toggleOption(value: string) {
    if (!multiple) {
      onChange([value]);
      setOpen(false);
      setQuery("");
      return;
    }
    onChange(selectedSet.has(value)
      ? selectedValues.filter((selectedValue) => selectedValue !== value)
      : [...selectedValues, value]);
  }

  const displayText = selectedOptions.length === 0
    ? placeholder
    : multiple
      ? selectedOptions.map((option) => option.label).join("、")
      : selectedOptions[0].label;

  return (
    <div className={`referenceSearchSelect${open ? " open" : ""}`} ref={containerRef}>
      <button
        className="referenceSearchTrigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className={selectedOptions.length === 0 ? "placeholder" : ""}>{displayText}</span>
        <i>{open ? "⌃" : "⌄"}</i>
      </button>
      {open ? (
        <div className="referenceSearchPanel">
          <div className="referenceSearchInput">
            <span aria-hidden="true">⌕</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
          {multiple && selectedValues.length > 0 ? (
            <div className="referenceSelectedSummary">
              <span>已选 {selectedValues.length} 项</span>
              <button type="button" onClick={() => onChange([])}>清空</button>
            </div>
          ) : null}
          <div className="referenceSearchOptions">
            {!multiple ? (
              <button
                className={selectedValues.length === 0 ? "selected" : ""}
                type="button"
                onClick={() => {
                  onChange([]);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="referenceOptionCheck">{selectedValues.length === 0 ? "✓" : ""}</span>
                <span className="referenceOptionCopy">
                  <strong>{placeholder}</strong>
                </span>
              </button>
            ) : null}
            {filteredOptions.map((option) => (
              <button
                className={selectedSet.has(option.value) ? "selected" : ""}
                type="button"
                key={option.value}
                onClick={() => toggleOption(option.value)}
              >
                <span className="referenceOptionCheck">{selectedSet.has(option.value) ? "✓" : ""}</span>
                <span className="referenceOptionCopy">
                  <strong>{option.label}</strong>
                  {option.description ? <em>{option.description}</em> : null}
                </span>
              </button>
            ))}
            {filteredOptions.length === 0 ? <p>没有匹配结果</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminDirectoryTreeNode({
  node,
  onEdit,
  onToggleStatus
}: {
  node: AdminDirectoryNode;
  onEdit: (directory: AdminDirectory) => void;
  onToggleStatus: (directory: AdminDirectory) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div className="adminDirectoryBranch">
      <div className="adminDirectoryTreeRow">
        <button
          className="adminDirectoryCollapse"
          type="button"
          disabled={!hasChildren}
          onClick={() => setCollapsed((current) => !current)}
          aria-label={hasChildren ? (collapsed ? `展开${node.name}` : `收起${node.name}`) : undefined}
        >
          {hasChildren ? (collapsed ? "›" : "⌄") : "·"}
        </button>
        <span className="adminDirectoryFolder" aria-hidden="true">{hasChildren ? "▣" : "□"}</span>
        <div className="adminDirectoryInfo">
          <strong>{node.name}</strong>
          <p>排序：{node.sortOrder}{node.description ? ` · ${node.description}` : ""}</p>
        </div>
        <span className={node.status === "active" ? "statusBadge active" : "statusBadge inactive"}>
          {node.status === "active" ? "启用" : "停用"}
        </span>
        <div className="adminActions">
          <button type="button" onClick={() => onEdit(node)}>编辑</button>
          <button type="button" onClick={() => onToggleStatus(node)}>
            {node.status === "active" ? "停用" : "启用"}
          </button>
        </div>
      </div>
      {!collapsed && hasChildren ? (
        <div className="adminDirectoryChildren">
          {node.children.map((child) => (
            <AdminDirectoryTreeNode
              key={child.id}
              node={child}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function countAssetsInDirectoryBranch(
  node: AdminDirectoryNode,
  assetsByDirectory: Map<number, AdminAsset[]>
): number {
  return (
    (assetsByDirectory.get(node.id)?.length ?? 0) +
    node.children.reduce(
      (total, child) => total + countAssetsInDirectoryBranch(child, assetsByDirectory),
      0
    )
  );
}

function filterDirectoryTreeWithAssets(
  nodes: AdminDirectoryNode[],
  assetsByDirectory: Map<number, AdminAsset[]>
): AdminDirectoryNode[] {
  return nodes.flatMap((node) => {
    const children = filterDirectoryTreeWithAssets(node.children, assetsByDirectory);
    if ((assetsByDirectory.get(node.id)?.length ?? 0) > 0 || children.length > 0) {
      return [{ ...node, children }];
    }
    return [];
  });
}

function AdminAssetDirectoryTreeNode({
  node,
  assetsByDirectory,
  typeNameMap,
  onEdit,
  onToggleStatus
}: {
  node: AdminDirectoryNode;
  assetsByDirectory: Map<number, AdminAsset[]>;
  typeNameMap: Map<string, string>;
  onEdit: (asset: AdminAsset) => void;
  onToggleStatus: (asset: AdminAsset) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const ownAssets = assetsByDirectory.get(node.id) ?? [];
  const totalAssets = countAssetsInDirectoryBranch(node, assetsByDirectory);

  return (
    <div className="adminAssetDirectoryBranch">
      <button
        className="adminAssetDirectoryHeader"
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        aria-expanded={!collapsed}
      >
        <span className="adminAssetDirectoryChevron" aria-hidden="true">{collapsed ? "›" : "⌄"}</span>
        <span className="adminAssetDirectoryFolder" aria-hidden="true">▣</span>
        <strong>{node.name}</strong>
        <em>{totalAssets} 个应用</em>
      </button>

      {!collapsed ? (
        <div className="adminAssetDirectoryContent">
          {ownAssets.map((asset) => (
            <div className="adminAssetTreeRow" key={asset.id}>
              <span className="adminAssetTreeIcon" aria-hidden="true">◇</span>
              <div className="adminAssetTreeInfo">
                <strong>{asset.name}</strong>
                <p>
                  {typeNameMap.get(asset.type) ?? asset.type} · {asset.ownerName || "未填负责人"} ·{" "}
                  {getResponsibleDepartments(asset.departmentName).join("、") || "未填主要负责部门"} ·
                  {asset.openMode === "new_tab" ? " 新标签页打开" : " 当前页打开"}
                </p>
                {asset.tags.length > 0 ? (
                  <div className="tagLine">
                    {asset.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                ) : null}
              </div>
              <span className={asset.status === "active" ? "statusBadge active" : "statusBadge inactive"}>
                {asset.status === "active" ? "启用" : "停用"}
              </span>
              <div className="adminActions">
                <button type="button" onClick={() => onEdit(asset)}>编辑</button>
                <button type="button" onClick={() => onToggleStatus(asset)}>
                  {asset.status === "active" ? "停用" : "启用"}
                </button>
              </div>
            </div>
          ))}

          {node.children.length > 0 ? (
            <div className="adminAssetDirectoryChildren">
              {node.children.map((child) => (
                <AdminAssetDirectoryTreeNode
                  key={child.id}
                  node={child}
                  assetsByDirectory={assetsByDirectory}
                  typeNameMap={typeNameMap}
                  onEdit={onEdit}
                  onToggleStatus={onToggleStatus}
                />
              ))}
            </div>
          ) : null}
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

function getResponsibleDepartments(value: string | null) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(/[,，]/)
        .map((department) => department.trim())
        .filter(Boolean)
    )
  );
}

function ResponsibleDepartmentValues({ value }: { value: string | null }) {
  const departments = getResponsibleDepartments(value);
  if (departments.length === 0) {
    return <span>未填写</span>;
  }

  return (
    <div className="tags responsibleDepartmentTags">
      {departments.map((department) => <span key={department}>{department}</span>)}
    </div>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  loading,
  alwaysVisible = false,
  onPrevPage,
  onNextPage,
  onGoToPage
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  loading: boolean;
  alwaysVisible?: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage?: (page: number) => void;
}) {
  const [pageInput, setPageInput] = useState("");

  if (!alwaysVisible && (totalItems <= pageSize || totalPages <= 1)) {
    return null;
  }

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;
  const submitPage = () => {
    const requestedPage = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(requestedPage)) {
      return;
    }
    onGoToPage?.(Math.min(totalPages, Math.max(1, requestedPage)));
    setPageInput("");
  };

  return (
    <div className="paginationBar">
      <p className="paginationMeta">共 {totalItems} 条数据</p>
      <div className="paginationActions">
        <button
          className="paginationButton"
          type="button"
          onClick={onPrevPage}
          disabled={loading || isFirstPage}
          aria-label="上一页"
          title="上一页"
        >
          ‹
        </button>
        <span className="paginationPageLabel">第</span>
        <strong className="paginationCurrentPage">{currentPage}</strong>
        <span className="paginationPageDivider">/</span>
        <strong className="paginationTotalPages">{totalPages}</strong>
        <span className="paginationPageLabel">页</span>
        <button
          className="paginationButton"
          type="button"
          onClick={onNextPage}
          disabled={loading || isLastPage}
          aria-label="下一页"
          title="下一页"
        >
          ›
        </button>
        {onGoToPage ? (
          <>
            <input
              className="paginationInput"
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              placeholder="输入页码"
              aria-label="输入页码"
              onChange={(event) => setPageInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitPage();
                }
              }}
            />
            <button
              className="paginationConfirmButton"
              type="button"
              disabled={loading || pageInput.trim() === ""}
              onClick={submitPage}
            >
              确定
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function AssetListPanel({
  panelId,
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
  onToggleFavorite,
  maxVisibleItems,
  alwaysShowPagination,
  typeFilterOptions,
  selectedType,
  onSelectType
}: {
  panelId?: string;
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
  maxVisibleItems?: number;
  alwaysShowPagination?: boolean;
  typeFilterOptions?: Array<{ code: string | null; name: string; count: number }>;
  selectedType?: string | null;
  onSelectType?: (type: string | null) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(assets.length / assetListPageSize));
  const paginatedAssets = useMemo(() => {
    const offset = (currentPage - 1) * assetListPageSize;
    return assets.slice(offset, offset + assetListPageSize);
  }, [assets, currentPage]);
  const visibleAssets = maxVisibleItems ? assets.slice(0, maxVisibleItems) : paginatedAssets;
  const hasHiddenAssets = maxVisibleItems ? assets.length > maxVisibleItems : false;

  useEffect(() => {
    setCurrentPage(1);
  }, [title, keyword]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="assetTablePanel" id={panelId}>
      {typeFilterOptions && onSelectType ? (
        <div className="assetFilterTabs" role="tablist" aria-label="应用类型过滤">
          {typeFilterOptions.map((option) => (
            <button
              className={selectedType === option.code ? "active" : ""}
              key={option.code ?? "all"}
              type="button"
              role="tab"
              aria-selected={selectedType === option.code}
              onClick={() => onSelectType(option.code)}
            >
              <span>{option.name}</span>
              <em>{option.count}</em>
            </button>
          ))}
        </div>
      ) : null}

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
            placeholder="名称、说明、负责人、主要负责部门、标签"
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
            <span>主要负责部门</span>
            <span>标签</span>
          </div>
          {visibleAssets.map((asset) => (
            <div className="assetTableRow" key={asset.id}>
              <div className="assetIdentity">
                <span
                  className={`assetIdentityIcon ${getTypeColorClass(assetTypeMap.get(asset.type)?.color)}`}
                  aria-hidden="true"
                >
                  {getTypeIcon(assetTypeMap.get(asset.type)?.icon)}
                </span>
                <div className="assetIdentityCopy">
                  <div className="assetTitleBar">
                    <span className="assetNameWithTooltip">
                      <a
                        className="assetNameLink"
                        href={asset.url}
                        {...getAssetLinkProps(asset.openMode)}
                        onClick={() => recordAssetOpen(asset.id)}
                      >
                        {asset.name}
                      </a>
                      <span className="assetDescriptionTooltip" role="tooltip">
                        {asset.description || "暂无说明"}
                      </span>
                    </span>
                    <FavoriteToggleButton
                      active={favoriteAssetIds.has(asset.id)}
                      disabled={favoritePendingIds.has(asset.id)}
                      onToggle={() => onToggleFavorite(asset.id)}
                    />
                  </div>
                </div>
              </div>
              <span className={`typePill ${getTypeColorClass(assetTypeMap.get(asset.type)?.color)}`}>
                {assetTypeMap.get(asset.type)?.name ?? asset.type}
              </span>
              <span>{asset.ownerName || "未填写"}</span>
              <ResponsibleDepartmentValues value={asset.departmentName} />
              <div className="tags">
                {asset.tags.length > 0 ? asset.tags.map((tag) => <span key={tag}>{tag}</span>) : "无"}
              </div>
            </div>
          ))}
        </div>
        ) : null}

      {hasHiddenAssets ? <div className="listOverflowHint" aria-label="还有更多应用">...</div> : null}

      {!maxVisibleItems ? (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={assets.length}
          pageSize={assetListPageSize}
          loading={loading}
          alwaysVisible={alwaysShowPagination}
          onPrevPage={() => setCurrentPage((page) => Math.max(1, page - 1))}
          onNextPage={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          onGoToPage={setCurrentPage}
        />
      ) : null}
    </div>
  );
}

function RpaTaskPanel({
  tasks,
  totalTasks,
  currentPage,
  totalPages,
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
  onViewLogs,
  onPrevPage,
  onNextPage
}: {
  tasks: RpaTask[];
  totalTasks: number;
  currentPage: number;
  totalPages: number;
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
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [startFeedback, setStartFeedback] = useState<{
    taskId: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function startTask(task: RpaTask) {
    setStartingTaskId(task.id);
    setStartFeedback(null);

    try {
      const response = await fetch(withBasePath(`/api/rpa/tasks/${encodeURIComponent(task.id)}/start`), {
        method: "POST",
        credentials: "include"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "启动请求失败");
      }

      setStartFeedback({
        taskId: task.id,
        type: "success",
        message: payload.data?.message ?? "启动请求已发送"
      });
    } catch (error) {
      setStartFeedback({
        taskId: task.id,
        type: "error",
        message: error instanceof Error ? error.message : "启动请求失败"
      });
    } finally {
      setStartingTaskId(null);
    }
  }

  return (
    <section className="workspaceCollectionPage rpaWorkspacePage">
      <section className="collectionHero rpaCollectionHero">
        <div className="collectionHeroCopy">
          <h1>{selectedDept ? `实在RPA / ${selectedDept}` : "实在RPA"}</h1>
          <p>集中查看、筛选并启动自动化任务，运行日志可随时追踪。</p>
        </div>
        <div className="collectionHeroMetrics">
          <div>
            <span>任务总数</span>
            <strong>{totalTasks}</strong>
          </div>
          <div>
            <span>部门数量</span>
            <strong>{departments.length}</strong>
          </div>
          <div>
            <span>状态类型</span>
            <strong>{statuses.length}</strong>
          </div>
        </div>
        <div className="collectionHeroSymbol rpaHeroSymbol" aria-hidden="true">RPA</div>
      </section>

      <section className="statsFilterBar rpaFilterPanel" aria-label="RPA 任务筛选">
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
        <div className="rpaFilterActions">
          <a
            className="rpaTicketLink"
            href="https://rcnpnv15d9no.feishu.cn/share/base/form/shrcneraIIa1omkESBwwUeY5pRh"
            target="_blank"
            rel="noreferrer"
          >
            提交工单
          </a>
          <a
            className="rpaSopLink"
            href="http://10.0.0.53:8888/ai-sop"
            target="_blank"
            rel="noreferrer"
          >
            编写SOP
          </a>
        </div>
      </section>

      <div className="assetTablePanel rpaWorkspaceTable">
        <div className="panelTitleRow">
          <div>
            <h2>RPA 任务</h2>
            <p>当前共 {totalTasks} 个任务，每页 {rpaTaskPageSize} 条。</p>
          </div>
          <a
            className="secondaryButton rpaConsoleLink"
            href="https://deop.ai-indeed.com/"
            target="_blank"
            rel="noreferrer"
          >
            前往实在控制台
          </a>
        </div>

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
          </div>
        ) : null}

        {tasks.length > 0 ? (
          <div className="rpaTable">
            <div className="rpaTableHead">
              <span>任务名称</span>
              <span>部门</span>
              <span>需求文档</span>
              <span>相关资料</span>
              <span>状态</span>
              <span>创建时间</span>
              <span>操作</span>
              <span>日志</span>
            </div>
            {tasks.map((task) => (
              <div className="rpaTableRow" key={task.id}>
                <div>
                  <span className="rpaTaskNameWithTooltip" tabIndex={0}>
                    <strong>{task.name}</strong>
                    <span className="rpaFrequencyTooltip" role="tooltip">
                      <span>运行时间</span>
                      <strong>{task.scheduleDescription}</strong>
                    </span>
                  </span>
                </div>
                <span>{task.deptName}</span>
                <span className="rpaReferenceCell">
                  <RpaReferenceValue value={task.requirementDocUrl} />
                </span>
                <span className="rpaReferenceCell">
                  <RpaReferenceValue value={task.relatedMaterialUrl} />
                </span>
                <span
                  className={`rpaStatusPill ${
                    task.status === "启用" ? "enabled" : task.status === "禁用" ? "disabled" : "missing"
                  }`}
                >
                  {task.status}
                </span>
                <span>{task.createdAt ? task.createdAt.slice(0, 19).replace("T", " ") : "未填写"}</span>
                <div className="rpaActionCell">
                  {startFeedback?.taskId === task.id ? (
                    <span className={startFeedback.type === "success" ? "rpaInlineNotice success" : "rpaInlineNotice error"}>
                      {startFeedback.message}
                    </span>
                  ) : null}
                  <button
                    className="rpaActionButton"
                    type="button"
                    disabled={startingTaskId === task.id}
                    onClick={() => startTask(task)}
                  >
                    {startingTaskId === task.id ? "启动中..." : "启动程序"}
                  </button>
                </div>
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
        ) : null}

        {!error ? (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalTasks}
            pageSize={rpaTaskPageSize}
            loading={loading}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
          />
        ) : null}
      </div>
    </section>
  );
}

function RpaLogPanel({
  task,
  recordPage,
  loading,
  error,
  onBack,
  onPrevPage,
  onNextPage
}: {
  task: RpaTask;
  recordPage: RpaRunRecordPage;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  const records = recordPage.items;
  const successRecordCount = records.filter((record) =>
    /成功|完成|success|completed/i.test(record.statusDesc || record.status || "")
  ).length;
  const errorRecordCount = records.filter((record) =>
    /失败|异常|error|fail/i.test(record.statusDesc || record.status || "")
  ).length;

  return (
    <section className="workspaceCollectionPage rpaLogWorkspacePage">
      <section className="collectionHero rpaLogCollectionHero">
        <div className="collectionHeroCopy">
          <h1>{task.name} / 运行日志</h1>
          <p>
            {task.deptName} · {task.taskUuid ?? "未配置 task_uuid"}
          </p>
        </div>
        <div className="collectionHeroMetrics">
          <div>
            <span>记录总数</span>
            <strong>{recordPage.total}</strong>
          </div>
          <div>
            <span>本页成功</span>
            <strong>{successRecordCount}</strong>
          </div>
          <div>
            <span>本页异常</span>
            <strong>{errorRecordCount}</strong>
          </div>
        </div>
        <div className="rpaHeroSide">
          <button className="secondaryButton" type="button" onClick={onBack}>
            返回任务列表
          </button>
          <div className="collectionHeroSymbol rpaLogHeroSymbol" aria-hidden="true">↶</div>
        </div>
      </section>

      <div className="assetTablePanel rpaWorkspaceTable rpaLogWorkspaceTable">
        <div className="panelTitleRow">
          <div>
            <h2>运行记录</h2>
            <p>只展示当前 RPA 程序的 rpa_run_record 记录，每页 10 条。</p>
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

        {records.length > 0 ? (
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
                <span
                  className={`rpaStatusPill ${
                    /成功|完成|success|completed/i.test(record.statusDesc || record.status || "")
                      ? "success"
                      : /失败|异常|error|fail/i.test(record.statusDesc || record.status || "")
                        ? "error"
                        : /运行|执行|running/i.test(record.statusDesc || record.status || "")
                          ? "running"
                          : "neutral"
                  }`}
                >
                  {record.statusDesc || record.status || "未填写"}
                </span>
                <span>{record.startedAt ? record.startedAt.slice(0, 19).replace("T", " ") : "未填写"}</span>
                <span>{record.endedAt ? record.endedAt.slice(0, 19).replace("T", " ") : "未填写"}</span>
                <span>{record.duration || "未填写"}</span>
                <span>{record.message || "无"}</span>
              </div>
            ))}
          </div>
        ) : null}

        {!error ? (
          <PaginationControls
            currentPage={recordPage.page}
            totalPages={recordPage.totalPages}
            totalItems={recordPage.total}
            pageSize={recordPage.pageSize}
            loading={loading}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
          />
        ) : null}
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
            <span>主要负责部门</span>
            <span>访问数</span>
          </div>
          {sortedAssets.slice(0, 10).map((asset) => (
            <div className="statsTableRow" key={asset.id}>
              <div>
                <div className="assetTitleBar">
                  <span className="assetNameWithTooltip">
                    <a
                      className="assetNameLink"
                      href={asset.url}
                      {...getAssetLinkProps(asset.openMode)}
                      onClick={() => recordAssetOpen(asset.id)}
                    >
                      {asset.name}
                    </a>
                    <span className="assetDescriptionTooltip" role="tooltip">
                      {asset.description || "暂无说明"}
                    </span>
                  </span>
                  <FavoriteToggleButton
                    active={favoriteAssetIds.has(asset.id)}
                    disabled={favoritePendingIds.has(asset.id)}
                    onToggle={() => onToggleFavorite(asset.id)}
                  />
                </div>
              </div>
              <span className={`typePill ${getTypeColorClass(assetTypeMap.get(asset.type)?.color)}`}>
                {assetTypeMap.get(asset.type)?.name ?? asset.type}
              </span>
              <span>{asset.ownerName || "未填写"}</span>
              <ResponsibleDepartmentValues value={asset.departmentName} />
              <strong className="clickCount">{asset.clickCount}</strong>
            </div>
          ))}
        </div>
        {sortedAssets.length > 10 ? <div className="listOverflowHint" aria-label="还有更多应用">...</div> : null}
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
  const rankedAssets = sortedAssets.slice(0, 10);
  const trendStatsMap = new Map(stats.dailyStats.map((item) => [item.date, item.clickCount]));
  const trendEndDate = new Date(`${endDate || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const trendStats = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(trendEndDate);
    date.setDate(date.getDate() - (13 - index));
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date: dateKey, clickCount: trendStatsMap.get(dateKey) ?? 0 };
  });
  const maxDailyClickCount = Math.max(...trendStats.map((item) => item.clickCount), 1);
  const chartWidth = 720;
  const chartBaseline = 190;
  const chartTop = 20;
  const roughTickStep = maxDailyClickCount / 4;
  const tickMagnitude = 10 ** Math.floor(Math.log10(roughTickStep));
  const normalizedTickStep = roughTickStep / tickMagnitude;
  const tickMultiplier =
    normalizedTickStep <= 1 ? 1 : normalizedTickStep <= 2 ? 2 : normalizedTickStep <= 5 ? 5 : 10;
  const chartTickStep = tickMultiplier * tickMagnitude;
  const chartAxisMax = chartTickStep * 4;
  const chartTicks = Array.from({ length: 5 }, (_, index) => ({
    value: chartAxisMax - index * chartTickStep,
    y: chartTop + (index / 4) * (chartBaseline - chartTop)
  }));
  const trendPoints = trendStats.map((item, index) => {
    const x = trendStats.length <= 1 ? chartWidth / 2 : 20 + (index / (trendStats.length - 1)) * (chartWidth - 40);
    const y = chartBaseline - (item.clickCount / chartAxisMax) * (chartBaseline - chartTop);
    return { ...item, x, y };
  });
  const trendLinePath = trendPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const trendAreaPath =
    trendPoints.length > 0
      ? `${trendLinePath} L ${trendPoints[trendPoints.length - 1].x} ${chartBaseline} L ${trendPoints[0].x} ${chartBaseline} Z`
      : "";
  const heatStatsMap = new Map(stats.dailyStats.map((item) => [item.date, item.clickCount]));
  const heatBaseDate = new Date(`${endDate || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const heatColumns = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(heatBaseDate);
    date.setDate(date.getDate() - (5 - index));
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date: dateKey, clickCount: heatStatsMap.get(dateKey) ?? 0 };
  });
  const heatRows = stats.typeStats.slice(0, 5);
  const maxTypeCount = Math.max(...heatRows.map((item) => item.count), 1);
  const departmentRows = stats.departmentStats.slice(0, 6);
  const maxDepartmentCount = Math.max(...departmentRows.map((item) => item.clickCount), 1);

  return (
    <section className="statsReport">
      <div className="detailHeader">
        <div>
          <h1>应用访问数据透视</h1>
          <span>按时间、应用类型与部门维度洞察入口访问情况。</span>
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

      <div className="statsOverviewCards">
        {[
          { label: hasDateRange ? "区间访问" : "总访问数", value: totalClickCount, tone: "blue" },
          { label: "今日访问", value: stats.todayClickCount, tone: "green" },
          { label: "近 7 天访问", value: stats.sevenDayClickCount, tone: "purple" },
          { label: "近 30 天访问", value: stats.thirtyDayClickCount, tone: "orange" }
        ].map((item) => (
          <div className={`statsOverviewCard statsOverview${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <svg viewBox="0 0 72 32" aria-hidden="true">
              <path d="M2 27 C14 25 18 19 27 22 C37 25 42 11 51 15 C60 19 64 7 70 5" />
            </svg>
          </div>
        ))}
      </div>

      <div className="statsDashboardGrid">
        <div className="statsDashboardMain">
          <section className="statsVisualCard statsTrendCard">
            <div className="statsCardHeading">
              <div>
                <h2>访问趋势</h2>
                <p>近 14 天应用访问变化</p>
              </div>
              <span>{totalClickCount} 次访问</span>
            </div>
            {trendPoints.length === 0 ? (
              <div className="emptyState compact">
                <h3>暂无趋势数据</h3>
                <p>产生访问记录后，这里会展示趋势。</p>
              </div>
            ) : (
              <div className="statsAreaChart">
                <div className="statsChartPlot">
                  <div className="statsChartYAxis" aria-hidden="true">
                    {chartTicks.map((tick) => (
                      <span key={tick.value} style={{ top: `${tick.y}px` }}>{tick.value}</span>
                    ))}
                  </div>
                  <svg viewBox={`0 0 ${chartWidth} 220`} preserveAspectRatio="none" role="img" aria-label="访问趋势图">
                    <defs>
                      <linearGradient id="statsAreaGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#45b7e9" stopOpacity="0.48" />
                        <stop offset="58%" stopColor="#6a82ed" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#9d63df" stopOpacity="0.42" />
                      </linearGradient>
                    </defs>
                    {chartTicks.map((tick) => (
                      <line key={tick.value} x1="20" x2={chartWidth - 20} y1={tick.y} y2={tick.y} className="statsChartGridLine" />
                    ))}
                    <path d={trendAreaPath} className="statsChartArea" />
                    <path d={trendLinePath} className="statsChartLine" />
                    {trendPoints.map((point) => (
                      <circle key={point.date} cx={point.x} cy={point.y} r="3.5">
                        <title>{`${point.date}: ${point.clickCount} 次`}</title>
                      </circle>
                    ))}
                  </svg>
                </div>
                <div className="statsChartLabels">
                  {trendPoints
                    .filter((_, index) => index === 0 || index === trendPoints.length - 1 || index % 3 === 0)
                    .map((point) => (
                      <span
                        key={point.date}
                        style={{ left: `${(point.x / chartWidth) * 100}%` }}
                      >
                        {point.date.slice(5)}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </section>

          <section className="statsVisualCard statsRankingCard">
            <div className="statsCardHeading">
              <div>
                <h2>应用访问数据</h2>
                <p>按访问次数从高到低排列</p>
              </div>
            </div>

            {error ? (
              <div className="emptyState compact">
                <h3>无法读取统计数据</h3>
                <p>{error}</p>
              </div>
            ) : null}

            {!loading && !error && sortedAssets.length === 0 ? (
              <div className="emptyState compact">
                <h3>暂无统计数据</h3>
                <p>新增应用并产生访问记录后，这里会展示数据。</p>
              </div>
            ) : null}

            <div className="statsCompactTable">
              <div className="statsCompactHead">
                <span>应用名称</span>
                <span>类型</span>
                <span>负责人</span>
                <span>主要负责部门</span>
                <span>访问数</span>
              </div>
              {rankedAssets.map((asset) => (
                <div className="statsCompactRow" key={asset.id}>
                  <div>
                    <a
                      href={asset.url}
                      {...getAssetLinkProps(asset.openMode)}
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
                  <span>{assetTypeMap.get(asset.type)?.name ?? asset.type}</span>
                  <span>{asset.ownerName || "未填写"}</span>
                  <ResponsibleDepartmentValues value={asset.departmentName} />
                  <strong>{hasDateRange ? rangeClickMap.get(asset.id) ?? 0 : asset.clickCount}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="statsVisualCard statsActivityCard">
          <div className="statsCardHeading">
            <div>
              <h2>应用访问热度</h2>
              <p>综合类型规模与每日访问趋势</p>
            </div>
          </div>

          <div className="statsHeatmap">
            <div className="statsHeatmapHeader">
              <span />
              {heatColumns.map((item) => <span key={item.date}>{item.date.slice(8)}</span>)}
            </div>
            {heatRows.map((row) => (
              <div className="statsHeatmapRow" key={row.code}>
                <strong>{row.name}</strong>
                {heatColumns.map((column, columnIndex) => {
                  const intensity = Math.max(
                    0.16,
                    Math.min(1, (row.count / maxTypeCount) * 0.55 + (column.clickCount / maxDailyClickCount) * 0.35 + columnIndex * 0.015)
                  );
                  return (
                    <i
                      key={`${row.code}-${column.date}`}
                      style={{ opacity: intensity }}
                      title={`${row.name} · ${column.date} 综合热度`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="statsDepartmentBars">
            <div className="statsSubheading">
              <h3>部门访问量</h3>
              <span>TOP {departmentRows.length}</span>
            </div>
            <div className="statsBarChart">
              {departmentRows.map((item, index) => (
                <div className="statsBarItem" key={`${item.name}-${index}`}>
                  <strong>{item.clickCount}</strong>
                  <div>
                    <i style={{ height: `${Math.max(12, (item.clickCount / maxDepartmentCount) * 100)}%` }} />
                  </div>
                  <span title={item.name}>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
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
  ownerWorkcode: "",
  departmentIds: [],
  url: "",
  openMode: "new_tab",
  tags: "",
  sortOrder: "0",
  status: "active"
};

const emptyQuickServiceGroupForm: QuickServiceGroupFormState = {
  name: "",
  description: "",
  sortOrder: "0",
  status: "active"
};

const emptyQuickServiceCardForm: QuickServiceCardFormState = {
  groupId: "",
  name: "",
  description: "",
  url: "",
  openMode: "new_tab",
  icon: "link",
  color: "blue",
  sortOrder: "0",
  status: "active"
};

const emptyRpaTaskForm: RpaTaskFormState = {
  name: "",
  deptName: "",
  taskUuid: "",
  requirementDocUrl: "",
  relatedMaterialUrl: ""
};

function AdminPanel({ onDataChanged }: { onDataChanged: () => void }) {
  const [activeTab, setActiveTab] = useState<"quickServices" | "directories" | "assets" | "types" | "rpaTasks">("assets");
  const [directories, setDirectories] = useState<AdminDirectory[]>([]);
  const [assetTypes, setAssetTypes] = useState<AdminAssetType[]>([]);
  const [assets, setAssets] = useState<AdminAsset[]>([]);
  const [eipUsers, setEipUsers] = useState<EipUserReference[]>([]);
  const [eipDepartments, setEipDepartments] = useState<EipDepartmentReference[]>([]);
  const [rpaTasks, setRpaTasks] = useState<AdminRpaTask[]>([]);
  const [quickServiceGroups, setQuickServiceGroups] = useState<AdminQuickServiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingDirectoryId, setEditingDirectoryId] = useState<number | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editingAssetTypeCode, setEditingAssetTypeCode] = useState<string | null>(null);
  const [editingRpaTaskId, setEditingRpaTaskId] = useState<string | null>(null);
  const [editingQuickServiceGroupId, setEditingQuickServiceGroupId] = useState<number | null>(null);
  const [editingQuickServiceCardId, setEditingQuickServiceCardId] = useState<number | null>(null);
  const [directoryForm, setDirectoryForm] = useState<DirectoryFormState>(emptyDirectoryForm);
  const [assetTypeForm, setAssetTypeForm] = useState<AssetTypeFormState>(emptyAssetTypeForm);
  const [assetForm, setAssetForm] = useState<AssetFormState>(emptyAssetForm);
  const [rpaTaskForm, setRpaTaskForm] = useState<RpaTaskFormState>(emptyRpaTaskForm);
  const [quickServiceGroupForm, setQuickServiceGroupForm] = useState<QuickServiceGroupFormState>(emptyQuickServiceGroupForm);
  const [quickServiceCardForm, setQuickServiceCardForm] = useState<QuickServiceCardFormState>(emptyQuickServiceCardForm);

  async function loadAdminData() {
    setLoading(true);
    setError(null);

    try {
      const [nextDirectories, nextTypes, nextAssets, nextRpaTasks, nextQuickServiceGroups, nextEipUsers, nextEipDepartments] = await Promise.all([
        fetchJson<AdminDirectory[]>("/api/admin/directories"),
        fetchJson<AdminAssetType[]>("/api/admin/asset-types"),
        fetchJson<AdminAsset[]>("/api/admin/assets"),
        fetchJson<AdminRpaTask[]>("/api/admin/rpa-tasks"),
        fetchJson<AdminQuickServiceGroup[]>("/api/admin/quick-service-groups"),
        fetchJson<EipUserReference[]>("/api/admin/eip-users"),
        fetchJson<EipDepartmentReference[]>("/api/admin/eip-departments")
      ]);
      setDirectories(nextDirectories);
      setAssetTypes(nextTypes);
      setAssets(nextAssets);
      setRpaTasks(nextRpaTasks);
      setQuickServiceGroups(nextQuickServiceGroups);
      setEipUsers(nextEipUsers);
      setEipDepartments(nextEipDepartments);
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
      ownerWorkcode: assetForm.ownerWorkcode || null,
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

  async function saveQuickServiceGroup() {
    setSaving(true);
    setError(null);
    const payload = {
      ...quickServiceGroupForm,
      sortOrder: Number(quickServiceGroupForm.sortOrder || 0)
    };
    try {
      if (editingQuickServiceGroupId) {
        await sendJson(`/api/admin/quick-service-groups/${editingQuickServiceGroupId}`, "PUT", payload);
      } else {
        await sendJson("/api/admin/quick-service-groups", "POST", payload);
      }
      setQuickServiceGroupForm(emptyQuickServiceGroupForm);
      setEditingQuickServiceGroupId(null);
      completeSave("快捷服务分组已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "快捷服务分组保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveQuickServiceCard() {
    setSaving(true);
    setError(null);
    const payload = {
      ...quickServiceCardForm,
      groupId: quickServiceCardForm.groupId ? Number(quickServiceCardForm.groupId) : null,
      sortOrder: Number(quickServiceCardForm.sortOrder || 0)
    };
    try {
      if (editingQuickServiceCardId) {
        await sendJson(`/api/admin/quick-service-cards/${editingQuickServiceCardId}`, "PUT", payload);
      } else {
        await sendJson("/api/admin/quick-service-cards", "POST", payload);
      }
      setQuickServiceCardForm(emptyQuickServiceCardForm);
      setEditingQuickServiceCardId(null);
      completeSave("快捷服务卡片已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "快捷服务卡片保存失败");
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
        requirementDocUrl: rpaTaskForm.requirementDocUrl,
        relatedMaterialUrl: rpaTaskForm.relatedMaterialUrl
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
      ownerWorkcode: asset.ownerWorkcode ?? "",
      departmentIds: asset.departmentIds,
      url: asset.url,
      openMode: asset.openMode,
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
      requirementDocUrl: task.requirementDocUrl ?? "",
      relatedMaterialUrl: task.relatedMaterialUrl ?? ""
    });
  }

  function editQuickServiceGroup(group: AdminQuickServiceGroup) {
    setActiveTab("quickServices");
    setEditingQuickServiceGroupId(group.id);
    setQuickServiceGroupForm({
      name: group.name,
      description: group.description ?? "",
      sortOrder: String(group.sortOrder),
      status: group.status
    });
  }

  function editQuickServiceCard(card: AdminQuickServiceCard) {
    setActiveTab("quickServices");
    setEditingQuickServiceCardId(card.id);
    setQuickServiceCardForm({
      groupId: String(card.groupId),
      name: card.name,
      description: card.description ?? "",
      url: card.url,
      openMode: card.openMode,
      icon: card.icon ?? "link",
      color: card.color,
      sortOrder: String(card.sortOrder),
      status: card.status
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
      ownerWorkcode: asset.ownerWorkcode,
      departmentIds: asset.departmentIds,
      url: asset.url,
      openMode: asset.openMode,
      tags: asset.tags,
      sortOrder: asset.sortOrder,
      status: asset.status === "active" ? "inactive" : "active"
    });
    completeSave("应用状态已更新");
  }

  async function toggleQuickServiceGroupStatus(group: AdminQuickServiceGroup) {
    await sendJson(`/api/admin/quick-service-groups/${group.id}`, "PUT", {
      name: group.name,
      description: group.description,
      sortOrder: group.sortOrder,
      status: group.status === "active" ? "inactive" : "active"
    });
    completeSave("快捷服务分组状态已更新");
  }

  async function toggleQuickServiceCardStatus(card: AdminQuickServiceCard) {
    await sendJson(`/api/admin/quick-service-cards/${card.id}`, "PUT", {
      groupId: card.groupId,
      name: card.name,
      description: card.description,
      url: card.url,
      openMode: card.openMode,
      icon: card.icon,
      color: card.color,
      sortOrder: card.sortOrder,
      status: card.status === "active" ? "inactive" : "active"
    });
    completeSave("快捷服务卡片状态已更新");
  }

  const typeNameMap = useMemo(
    () => new Map(assetTypes.map((assetType) => [assetType.code, assetType.name])),
    [assetTypes]
  );
  const adminDirectoryTree = useMemo(() => buildAdminDirectoryTree(directories), [directories]);
  const assetsByDirectory = useMemo(() => {
    const groupedAssets = new Map<number, AdminAsset[]>();
    assets.forEach((asset) => {
      const directoryAssets = groupedAssets.get(asset.directoryId) ?? [];
      directoryAssets.push(asset);
      groupedAssets.set(asset.directoryId, directoryAssets);
    });
    groupedAssets.forEach((directoryAssets) => {
      directoryAssets.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    });
    return groupedAssets;
  }, [assets]);
  const assetDirectoryTree = useMemo(
    () => filterDirectoryTreeWithAssets(adminDirectoryTree, assetsByDirectory),
    [adminDirectoryTree, assetsByDirectory]
  );
  const knownDirectoryIds = useMemo(() => new Set(directories.map((directory) => directory.id)), [directories]);
  const unassignedAssets = useMemo(
    () => assets.filter((asset) => !asset.directoryId || !knownDirectoryIds.has(asset.directoryId)),
    [assets, knownDirectoryIds]
  );
  const blockedParentDirectoryIds = useMemo(() => {
    if (!editingDirectoryId) {
      return new Set<number>();
    }

    const directoryMap = new Map(directories.map((directory) => [directory.id, directory]));
    const blockedIds = new Set<number>([editingDirectoryId]);
    directories.forEach((directory) => {
      let parentId = directory.parentId;
      const visited = new Set<number>();
      while (parentId && directoryMap.has(parentId) && !visited.has(parentId)) {
        if (parentId === editingDirectoryId) {
          blockedIds.add(directory.id);
          break;
        }
        visited.add(parentId);
        parentId = directoryMap.get(parentId)?.parentId ?? null;
      }
    });
    return blockedIds;
  }, [directories, editingDirectoryId]);

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
        <button
          className={activeTab === "quickServices" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("quickServices")}
        >
          快捷服务
        </button>
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

      {!loading && activeTab === "quickServices" ? (
        <div className="adminGrid adminQuickServiceGrid">
          <div className="adminQuickServiceColumn">
            <form className="adminCard adminForm" onSubmit={(event) => event.preventDefault()}>
              <div className="adminSectionHeader">
                <div>
                  <h2>{editingQuickServiceGroupId ? "编辑分组" : "新增分组"}</h2>
                  <p>分组用于组织首页和快捷服务页中的卡片。</p>
                </div>
                {editingQuickServiceGroupId ? (
                  <button className="secondaryButton" type="button" onClick={() => {
                    setEditingQuickServiceGroupId(null);
                    setQuickServiceGroupForm(emptyQuickServiceGroupForm);
                  }}>取消编辑</button>
                ) : null}
              </div>
              <div className="formGrid">
                <label>
                  分组名称
                  <input value={quickServiceGroupForm.name} onChange={(event) => setQuickServiceGroupForm({ ...quickServiceGroupForm, name: event.target.value })} />
                </label>
                <label>
                  排序
                  <input type="number" value={quickServiceGroupForm.sortOrder} onChange={(event) => setQuickServiceGroupForm({ ...quickServiceGroupForm, sortOrder: event.target.value })} />
                </label>
                <label>
                  状态
                  <select value={quickServiceGroupForm.status} onChange={(event) => setQuickServiceGroupForm({ ...quickServiceGroupForm, status: event.target.value as AdminStatus })}>
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                </label>
                <label className="wideField">
                  分组说明
                  <textarea value={quickServiceGroupForm.description} onChange={(event) => setQuickServiceGroupForm({ ...quickServiceGroupForm, description: event.target.value })} />
                </label>
              </div>
              <button className="primaryButton" type="button" disabled={saving} onClick={saveQuickServiceGroup}>
                {saving ? "保存中..." : "保存分组"}
              </button>
            </form>

            <div className="adminCard adminList">
              <div className="adminSectionHeader"><div><h2>分组列表</h2><p>共 {quickServiceGroups.length} 个分组。</p></div></div>
              {quickServiceGroups.map((group) => (
                <div className="adminRow" key={group.id}>
                  <div><strong>{group.name}</strong><p>{group.cards.length} 张卡片 · 排序：{group.sortOrder}</p></div>
                  <span className={group.status === "active" ? "statusBadge active" : "statusBadge inactive"}>{group.status === "active" ? "启用" : "停用"}</span>
                  <div className="adminActions">
                    <button type="button" onClick={() => editQuickServiceGroup(group)}>编辑</button>
                    <button type="button" onClick={() => toggleQuickServiceGroupStatus(group)}>{group.status === "active" ? "停用" : "启用"}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="adminQuickServiceColumn">
            <form className="adminCard adminForm" onSubmit={(event) => event.preventDefault()}>
              <div className="adminSectionHeader">
                <div>
                  <h2>{editingQuickServiceCardId ? "编辑卡片" : "新增卡片"}</h2>
                  <p>配置表单或业务页面的名称、链接和展示样式。</p>
                </div>
                {editingQuickServiceCardId ? (
                  <button className="secondaryButton" type="button" onClick={() => {
                    setEditingQuickServiceCardId(null);
                    setQuickServiceCardForm(emptyQuickServiceCardForm);
                  }}>取消编辑</button>
                ) : null}
              </div>
              <div className="formGrid">
                <label>
                  所属分组
                  <select value={quickServiceCardForm.groupId} onChange={(event) => setQuickServiceCardForm({ ...quickServiceCardForm, groupId: event.target.value })}>
                    <option value="">请选择</option>
                    {quickServiceGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
                <label>
                  卡片名称
                  <input value={quickServiceCardForm.name} onChange={(event) => setQuickServiceCardForm({ ...quickServiceCardForm, name: event.target.value })} />
                </label>
                <label className="wideField">
                  跳转链接
                  <input value={quickServiceCardForm.url} onChange={(event) => setQuickServiceCardForm({ ...quickServiceCardForm, url: event.target.value })} />
                </label>
                <label>
                  打开方式
                  <select value={quickServiceCardForm.openMode} onChange={(event) => setQuickServiceCardForm({ ...quickServiceCardForm, openMode: event.target.value as Asset["openMode"] })}>
                    <option value="new_tab">新标签页打开</option>
                    <option value="current_tab">当前页打开</option>
                  </select>
                </label>
                <label>
                  图标
                  <select value={quickServiceCardForm.icon} onChange={(event) => setQuickServiceCardForm({ ...quickServiceCardForm, icon: event.target.value })}>
                    <option value="link">链接</option><option value="table">表格</option><option value="workflow">流程</option><option value="chart">报表</option><option value="system">系统</option>
                  </select>
                </label>
                <label>
                  颜色
                  <select value={quickServiceCardForm.color} onChange={(event) => setQuickServiceCardForm({ ...quickServiceCardForm, color: event.target.value })}>
                    <option value="blue">蓝色</option><option value="green">绿色</option><option value="purple">紫色</option><option value="orange">橙色</option><option value="gray">灰色</option>
                  </select>
                </label>
                <label>
                  排序
                  <input type="number" value={quickServiceCardForm.sortOrder} onChange={(event) => setQuickServiceCardForm({ ...quickServiceCardForm, sortOrder: event.target.value })} />
                </label>
                <label>
                  状态
                  <select value={quickServiceCardForm.status} onChange={(event) => setQuickServiceCardForm({ ...quickServiceCardForm, status: event.target.value as AdminStatus })}>
                    <option value="active">启用</option><option value="inactive">停用</option>
                  </select>
                </label>
                <label className="wideField">
                  卡片说明
                  <textarea value={quickServiceCardForm.description} onChange={(event) => setQuickServiceCardForm({ ...quickServiceCardForm, description: event.target.value })} />
                </label>
              </div>
              <button className="primaryButton" type="button" disabled={saving || quickServiceGroups.length === 0} onClick={saveQuickServiceCard}>
                {saving ? "保存中..." : "保存卡片"}
              </button>
            </form>

            <div className="adminCard adminList">
              <div className="adminSectionHeader"><div><h2>卡片列表</h2><p>按分组展示快捷入口。</p></div></div>
              {quickServiceGroups.flatMap((group) => group.cards.map((card) => (
                <div className="adminRow" key={card.id}>
                  <div><strong>{card.name}</strong><p>{group.name} · 排序：{card.sortOrder}</p></div>
                  <span className={card.status === "active" ? "statusBadge active" : "statusBadge inactive"}>{card.status === "active" ? "启用" : "停用"}</span>
                  <div className="adminActions">
                    <button type="button" onClick={() => editQuickServiceCard(card)}>编辑</button>
                    <button type="button" onClick={() => toggleQuickServiceCardStatus(card)}>{card.status === "active" ? "停用" : "启用"}</button>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </div>
      ) : null}

      {!loading && activeTab === "assets" ? (
        <div className="adminGrid">
          <form className="adminCard adminForm" onSubmit={(event) => event.preventDefault()}>
            <div className="adminSectionHeader">
              <div>
                <h2>{editingAssetId ? "编辑应用" : "新增应用"}</h2>
                <p>支持维护名称、链接、标签、负责人和主要负责部门。</p>
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
              <div className="formField">
                <span className="formFieldLabel">所属目录</span>
                <DirectoryTreePicker
                  directories={directories}
                  value={assetForm.directoryId}
                  onChange={(directoryId) => setAssetForm({ ...assetForm, directoryId })}
                />
              </div>
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
              <div className="formField">
                <span className="formFieldLabel">负责人</span>
                <ReferenceSearchSelect
                  options={eipUsers.map((user) => ({
                    value: user.id,
                    label: user.name,
                    description: [user.id, user.departmentName, user.email].filter(Boolean).join(" · ")
                  }))}
                  selectedValues={assetForm.ownerWorkcode ? [assetForm.ownerWorkcode] : []}
                  onChange={(values) => setAssetForm({ ...assetForm, ownerWorkcode: values[0] ?? "" })}
                  placeholder="未指定"
                  searchPlaceholder="搜索姓名、工号、部门或邮箱"
                />
              </div>
              <div className="formField wideField">
                <span className="formFieldLabel">主要负责部门</span>
                <ReferenceSearchSelect
                  multiple
                  options={eipDepartments.map((department) => ({
                    value: department.id,
                    label: department.fullName,
                    description: department.id
                  }))}
                  selectedValues={assetForm.departmentIds}
                  onChange={(departmentIds) => setAssetForm({ ...assetForm, departmentIds })}
                  placeholder="请选择部门"
                  searchPlaceholder="搜索部门名称"
                />
              </div>
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
              <label>
                打开方式
                <select
                  value={assetForm.openMode}
                  onChange={(event) => setAssetForm({ ...assetForm, openMode: event.target.value as Asset["openMode"] })}
                >
                  <option value="current_tab">当前页打开</option>
                  <option value="new_tab">新标签页打开</option>
                </select>
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
                <p>按所属目录展示，共 {assets.length} 个应用。</p>
              </div>
            </div>
            <div className="adminAssetTree">
              {assetDirectoryTree.map((directory) => (
                <AdminAssetDirectoryTreeNode
                  key={directory.id}
                  node={directory}
                  assetsByDirectory={assetsByDirectory}
                  typeNameMap={typeNameMap}
                  onEdit={editAsset}
                  onToggleStatus={toggleAssetStatus}
                />
              ))}
              {unassignedAssets.length > 0 ? (
                <div className="adminAssetDirectoryBranch">
                  <div className="adminAssetDirectoryHeader static">
                    <span className="adminAssetDirectoryChevron" aria-hidden="true">·</span>
                    <span className="adminAssetDirectoryFolder" aria-hidden="true">□</span>
                    <strong>未归类应用</strong>
                    <em>{unassignedAssets.length} 个应用</em>
                  </div>
                  <div className="adminAssetDirectoryContent">
                    {unassignedAssets.map((asset) => (
                      <div className="adminAssetTreeRow" key={asset.id}>
                        <span className="adminAssetTreeIcon" aria-hidden="true">◇</span>
                        <div className="adminAssetTreeInfo">
                          <strong>{asset.name}</strong>
                          <p>{typeNameMap.get(asset.type) ?? asset.type} · {asset.ownerName || "未填负责人"}</p>
                        </div>
                        <span className={asset.status === "active" ? "statusBadge active" : "statusBadge inactive"}>
                          {asset.status === "active" ? "启用" : "停用"}
                        </span>
                        <div className="adminActions">
                          <button type="button" onClick={() => editAsset(asset)}>编辑</button>
                          <button type="button" onClick={() => toggleAssetStatus(asset)}>
                            {asset.status === "active" ? "停用" : "启用"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {assetDirectoryTree.length === 0 && unassignedAssets.length === 0 ? (
                <p className="directoryPickerNoResult">暂无应用</p>
              ) : null}
            </div>
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
              <div className="formField">
                <span className="formFieldLabel">上级目录</span>
                <DirectoryTreePicker
                  directories={directories}
                  value={directoryForm.parentId}
                  onChange={(parentId) => setDirectoryForm({ ...directoryForm, parentId })}
                  allowEmpty
                  emptyLabel="无，作为一级目录"
                  disabledIds={blockedParentDirectoryIds}
                />
              </div>
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
            <div className="adminDirectoryTree">
              {adminDirectoryTree.map((directory) => (
                <AdminDirectoryTreeNode
                  key={directory.id}
                  node={directory}
                  onEdit={editDirectory}
                  onToggleStatus={toggleDirectoryStatus}
                />
              ))}
            </div>
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
                <p>维护需求文档和相关资料的链接或文本内容，任务名称、部门和 UUID 为只读。</p>
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
                需求文档（链接或文本）
                <textarea
                  value={rpaTaskForm.requirementDocUrl}
                  placeholder="请输入 http(s) 链接或文本内容"
                  onChange={(event) =>
                    setRpaTaskForm({ ...rpaTaskForm, requirementDocUrl: event.target.value })
                  }
                />
              </label>
              <label className="wideField">
                相关资料（链接或文本）
                <textarea
                  value={rpaTaskForm.relatedMaterialUrl}
                  placeholder="请输入 http(s) 链接或文本内容"
                  onChange={(event) =>
                    setRpaTaskForm({ ...rpaTaskForm, relatedMaterialUrl: event.target.value })
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
                {saving ? "保存中..." : "保存链接"}
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
                    <span>{task.relatedMaterialUrl ? "已配置相关资料" : "未配置相关资料"}</span>
                  </div>
                </div>
                <span className={task.requirementDocUrl ? "statusBadge active" : "statusBadge inactive"}>
                  {task.requirementDocUrl ? "已配置" : "待补充"}
                </span>
                <div className="adminActions">
                  <button type="button" onClick={() => editRpaTask(task)}>
                    编辑
                  </button>
                  {isHttpUrl(task.requirementDocUrl) ? (
                    <a
                      className="secondaryButton adminLinkButton"
                      href={task.requirementDocUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开文档
                    </a>
                  ) : null}
                  {isHttpUrl(task.relatedMaterialUrl) ? (
                    <a
                      className="secondaryButton adminLinkButton"
                      href={task.relatedMaterialUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开资料
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
  const [quickServices, setQuickServices] = useState<ApiState<QuickServiceGroup[]>>({
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
  const [recentAssets, setRecentAssets] = useState<ApiState<Asset[]>>({
    data: [],
    loading: true,
    error: null
  });
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
  const [rpaRunRecords, setRpaRunRecords] = useState<ApiState<RpaRunRecordPage>>({
    data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
    loading: false,
    error: null
  });
  const [rpaTaskPage, setRpaTaskPage] = useState(1);
  const [rpaRunRecordPage, setRpaRunRecordPage] = useState(1);
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
  const [rpaCollapsed, setRpaCollapsed] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statsStartDate, setStatsStartDate] = useState(() => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 29);
    return `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
  });
  const [statsEndDate, setStatsEndDate] = useState("");
  const [statsType, setStatsType] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<SessionUser | null>("/api/auth/me")
      .then((data) => {
        if (!data) {
          window.location.href = withBasePath("/login");
          return;
        }
        setCurrentUser(data);
      })
      .catch(() => setCurrentUser(null));

    fetchJson<Directory[]>("/api/directories")
      .then((data) => setDirectories({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setDirectories({ data: [], loading: false, error: error.message })
      );
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setRecentAssets((current) => ({ ...current, loading: true, error: null }));
    fetchJson<Asset[]>("/api/recent-assets")
      .then((data) => setRecentAssets({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setRecentAssets({ data: [], loading: false, error: error.message })
      );
  }, [currentUser]);

  useEffect(() => {
    const handleAssetOpened = (event: Event) => {
      const assetId = (event as CustomEvent<number>).detail;
      const openedAsset = assets.data.find((asset) => asset.id === assetId);
      if (!openedAsset) {
        return;
      }

      setRecentAssets((current) => ({
        data: [openedAsset, ...current.data.filter((asset) => asset.id !== assetId)].slice(0, 4),
        loading: false,
        error: null
      }));
    };

    window.addEventListener("asset-opened", handleAssetOpened);
    return () => window.removeEventListener("asset-opened", handleAssetOpened);
  }, [assets.data]);

  useEffect(() => {
    fetchJson<AssetTypeDefinition[]>("/api/asset-types")
      .then((data) => setAssetTypes({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setAssetTypes({ data: [], loading: false, error: error.message })
      );
  }, []);

  useEffect(() => {
    fetchJson<QuickServiceGroup[]>("/api/quick-services")
      .then((data) => setQuickServices({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setQuickServices({ data: [], loading: false, error: error.message })
      );
  }, []);

  useEffect(() => {
    fetchJson<RpaTask[]>("/api/rpa/tasks")
      .then((data) => setRpaTasks({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setRpaTasks({ data: [], loading: false, error: error.message })
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
  const assetFilterOptions = useMemo(() => {
    const countMap = new Map(stats.data.typeStats.map((item) => [item.code, item.count]));
    const typedOptions = assetTypes.data.slice(0, 3).map((assetType) => ({
      code: assetType.code,
      name: assetType.name,
      count: countMap.get(assetType.code) ?? 0
    }));
    const totalCount =
      stats.data.assetCount || stats.data.typeStats.reduce((total, item) => total + item.count, 0);

    return [{ code: null, name: "全部应用", count: totalCount }, ...typedOptions];
  }, [assetTypes.data, stats.data.assetCount, stats.data.typeStats]);
  const selectedTypeName = selectedType ? assetTypeMap.get(selectedType)?.name ?? selectedType : null;
  const recommendedAssets = useMemo(
    () =>
      [...assets.data]
        .sort((left, right) => right.clickCount - left.clickCount || right.id - left.id)
        .slice(0, 4),
    [assets.data]
  );
  const favoriteAssets = useMemo(() => {
    return assets.data.filter((asset) => favoriteAssetIds.has(asset.id));
  }, [assets.data, favoriteAssetIds]);
  const rpaDepartments = useMemo(() => {
    return Array.from(new Set(rpaTasks.data.map((task) => task.deptName))).sort((left, right) =>
      left.localeCompare(right, "zh-Hans-CN")
    );
  }, [rpaTasks.data]);
  const rpaStatuses = useMemo(() => {
    const availableStatuses = new Set(rpaTasks.data.map((task) => task.status));
    return rpaTaskStatusOrder.filter((status) => availableStatuses.has(status));
  }, [rpaTasks.data]);
  const filteredRpaTasks = useMemo(() => {
    const normalizedKeyword = rpaKeyword.trim().toLowerCase();

    return rpaTasks.data.filter((task) => {
      if (selectedRpaDept && task.deptName !== selectedRpaDept) {
        return false;
      }

      if (selectedRpaStatus && task.status !== selectedRpaStatus) {
        return false;
      }

      if (normalizedKeyword && !task.name.toLowerCase().includes(normalizedKeyword)) {
        return false;
      }

      return true;
    });
  }, [rpaTasks.data, selectedRpaDept, selectedRpaStatus, rpaKeyword]);
  const paginatedRpaTasks = useMemo(() => {
    const offset = (rpaTaskPage - 1) * rpaTaskPageSize;
    return filteredRpaTasks.slice(offset, offset + rpaTaskPageSize);
  }, [filteredRpaTasks, rpaTaskPage]);
  const rpaTaskTotalPages = Math.max(1, Math.ceil(filteredRpaTasks.length / rpaTaskPageSize));
  const selectedRpaLogRecords = rpaRunRecords.data;

  useEffect(() => {
    if (directories.loading || directories.error || directoryTree.length === 0) {
      return;
    }

    setCollapsedDirectoryIds((current) => {
      if (current.size > 0) {
        return current;
      }

      return new Set(collectCollapsibleDirectoryIds(directoryTree));
    });
  }, [directories.loading, directories.error, directoryTree]);

  useEffect(() => {
    setRpaTaskPage(1);
  }, [selectedRpaDept, selectedRpaStatus, rpaKeyword]);

  useEffect(() => {
    if (rpaTaskPage > rpaTaskTotalPages) {
      setRpaTaskPage(rpaTaskTotalPages);
    }
  }, [rpaTaskPage, rpaTaskTotalPages]);

  useEffect(() => {
    if (activeView !== "rpaLogs" || !selectedRpaLogTask?.taskUuid) {
      return;
    }

    setRpaRunRecords((current) => ({ ...current, loading: true, error: null }));
    fetchJson<RpaRunRecordPage>(
      `/api/rpa/run-records?page=${rpaRunRecordPage}&pageSize=10&taskUuid=${encodeURIComponent(selectedRpaLogTask.taskUuid)}`
    )
      .then((data) => setRpaRunRecords({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setRpaRunRecords({
          data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
          loading: false,
          error: error.message
        })
      );
  }, [activeView, selectedRpaLogTask, rpaRunRecordPage]);

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

  function openQuickServices() {
    setActiveView("quickServices");
    setSelectedDirectoryId(null);
  }

  function openAllApplications() {
    setSelectedType(null);
    window.requestAnimationFrame(() => {
      document.getElementById("all-applications")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
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
    setRpaTaskPage(1);
    setSelectedRpaLogTask(null);
    setRpaRunRecordPage(1);
    setRpaRunRecords({
      data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
      loading: false,
      error: null
    });
  }

  function resetRpaFilters() {
    setRpaKeyword("");
    setSelectedRpaDept(null);
    setSelectedRpaStatus(null);
    setRpaTaskPage(1);
  }

  function openRpaLogs(task: RpaTask) {
    setRpaRunRecordPage(1);
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
    fetchJson<QuickServiceGroup[]>("/api/quick-services")
      .then((data) => setQuickServices({ data, loading: false, error: null }))
      .catch((error: Error) =>
        setQuickServices({ data: [], loading: false, error: error.message })
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

  const appShellClassName = [
    "appShell",
    sidebarCollapsed ? "sidebarIsCollapsed" : "",
    activeView === "home" && selectedDirectoryId === null ? "homeDashboardMode" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={appShellClassName}>
      <aside className="sidebar">
        <div className="brandRow">
          <div className="portalBrand" title="华徽集团">
            <Image
              src={withBasePath("/assets/huahui-brand/huahui-logo.png")}
              alt="华徽集团 HUAHUI"
              width={156}
              height={42}
              priority
            />
          </div>
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
          className={activeView === "quickServices" ? "homeNav active" : "homeNav"}
          type="button"
          onClick={openQuickServices}
        >
          <span>⚡</span>
          <strong>快捷服务</strong>
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
          <div className={`${activeView === "rpa" ? "parentNav active" : "parentNav"} sidebarTreeRoot`}>
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
                <div className="parentNav sidebarTreeChild" key={deptName}>
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
              <a className="topHelpButton" href={withBasePath("/manual")} title="查看使用说明" aria-label="查看使用说明">
                ?
              </a>
              <div className="userMenu">
                <button
                  className="userMenuTrigger"
                  type="button"
                  onClick={() => setUserMenuOpen((value) => !value)}
                  aria-expanded={userMenuOpen}
                >
                  <span className="userAvatar" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z" />
                      <path d="M4.8 20c.5-3.8 3.3-6 7.2-6s6.7 2.2 7.2 6" />
                    </svg>
                  </span>
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
            recordPage={selectedRpaLogRecords}
            loading={rpaRunRecords.loading}
            error={rpaRunRecords.error}
            onBack={() => openRpa(selectedRpaLogTask.deptName)}
            onPrevPage={() => setRpaRunRecordPage((current) => Math.max(1, current - 1))}
            onNextPage={() =>
              setRpaRunRecordPage((current) =>
                Math.min(selectedRpaLogRecords.totalPages, current + 1)
              )
            }
          />
        ) : activeView === "rpa" ? (
          <RpaTaskPanel
            tasks={paginatedRpaTasks}
            totalTasks={filteredRpaTasks.length}
            currentPage={rpaTaskPage}
            totalPages={rpaTaskTotalPages}
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
            onPrevPage={() => setRpaTaskPage((current) => Math.max(1, current - 1))}
            onNextPage={() => setRpaTaskPage((current) => Math.min(rpaTaskTotalPages, current + 1))}
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
        ) : activeView === "quickServices" ? (
          <section className="quickServicesPage">
            <section className="collectionHero quickServicesHero">
              <div className="collectionHeroCopy">
                <h1>快捷服务</h1>
                <p>常用表单与业务入口按目录分组展示，点击卡片即可办理。</p>
              </div>
              <div className="collectionHeroMetrics">
                <div>
                  <span>服务分组</span>
                  <strong>{quickServices.data.length}</strong>
                </div>
                <div>
                  <span>快捷入口</span>
                  <strong>{quickServices.data.reduce((total, group) => total + group.cards.length, 0)}</strong>
                </div>
              </div>
              <div className="collectionHeroSymbol" aria-hidden="true">⚡</div>
            </section>
            <QuickServiceGroups
              groups={quickServices.data}
              loading={quickServices.loading}
              error={quickServices.error}
            />
          </section>
        ) : activeView === "favorites" ? (
          <section className="workspaceCollectionPage favoritesCollectionPage">
            <section className="collectionHero">
              <div className="collectionHeroCopy">
                <h1>我的收藏</h1>
                <p>集中管理常用应用入口，快速返回高频工作场景。</p>
              </div>
              <div className="collectionHeroMetrics">
                <div>
                  <span>收藏总数</span>
                  <strong>{favoriteAssetIds.size}</strong>
                </div>
                <div>
                  <span>当前显示</span>
                  <strong>{favoriteAssets.length}</strong>
                </div>
                <div>
                  <span>应用类型</span>
                  <strong>{new Set(favoriteAssets.map((asset) => asset.type)).size}</strong>
                </div>
              </div>
              <div className="collectionHeroSymbol" aria-hidden="true">★</div>
            </section>

            <TypeFilterBar
              assetTypes={assetTypes.data}
              selectedType={selectedType}
              onSelectType={setSelectedType}
            />

            <AssetListPanel
              title={selectedTypeName ? `${selectedTypeName}收藏` : "收藏应用"}
              description={`当前展示 ${favoriteAssets.length} 个已收藏应用`}
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
          </section>
        ) : selectedDirectoryId === null ? (
          <section className="workspaceHome">
            <section className="workspaceTopGrid">
              <div className="workspaceWelcomeCard">
                <div className="workspaceWelcomeCopy">
                  <h1>你好，{currentUser?.name || "伙伴"}，</h1>
                  <p>这是您的智能工作台，快速找到应用、流程和数据。</p>
                  <span className="workspaceStatusPill">AI 核心状态</span>
                </div>
                <div className="workspaceAiOrb" aria-hidden="true">
                  <span>AI</span>
                </div>
              </div>

              <div className="workspaceResourceBlock">
                <div className="workspaceSectionHeading">
                  <div>
                    <h2>资源概览</h2>
                    <p>汇总当前可用的应用与智能资源</p>
                  </div>
                </div>
                <div className="workspaceMetricCards">
                  <button className="workspaceMetricCard metricGreen" type="button" onClick={openAllApplications}>
                    <span>应用</span>
                    <strong>{stats.data.assetCount || assets.data.length}</strong>
                    <em>↓</em>
                  </button>
                  <button className="workspaceMetricCard metricPurple" type="button" onClick={openFavorites}>
                    <span>收藏</span>
                    <strong>{favoriteAssetIds.size}</strong>
                    <em>☆</em>
                  </button>
                  <button className="workspaceMetricCard metricIndigo" type="button" onClick={openStats}>
                    <span>访问</span>
                    <strong>{stats.data.clickCount || 0}</strong>
                    <em>↗</em>
                  </button>
                </div>
              </div>
            </section>

            <section className="workspaceUtilityGrid">
              <div className="workspaceRecentPanel">
                <div className="workspaceSectionHeading">
                  <div>
                    <h2>最近使用的应用</h2>
                    <p>根据近期访问频次展示常用入口</p>
                  </div>
                  <button type="button" onClick={() => setSelectedType(null)}>查看全部 ›</button>
                </div>
                <div className="workspaceRecentGrid">
                  {recentAssets.data.map((asset) => (
                    <a
                      href={asset.url}
                      key={asset.id}
                      {...getAssetLinkProps(asset.openMode)}
                      onClick={() => recordAssetOpen(asset.id)}
                    >
                      <span className={getTypeColorClass(assetTypeMap.get(asset.type)?.color)}>
                        {getTypeIcon(assetTypeMap.get(asset.type)?.icon)}
                      </span>
                      <div>
                        <strong>{asset.name}</strong>
                        <em>{asset.clickCount} 次访问</em>
                      </div>
                      <i>›</i>
                    </a>
                  ))}
                  {!recentAssets.loading && recentAssets.data.length === 0 ? (
                    <p className="workspaceRecentEmpty">暂无最近使用记录</p>
                  ) : null}
                </div>
              </div>

              <div className="workspaceAnalysisCard">
                <div className="workspaceSectionHeading compact">
                  <div>
                    <h2>资源分析</h2>
                    <p>按应用类型统计</p>
                  </div>
                  <button type="button" onClick={openStats}>查看详情</button>
                </div>
                <div className="workspaceAnalysisBody">
                  <div className="workspaceLegend">
                    {(stats.data.typeStats.length > 0
                      ? stats.data.typeStats.slice(0, 4)
                      : assetTypes.data.slice(0, 4).map((type) => ({ code: type.code, name: type.name, count: 0 }))
                    ).map((item, index) => (
                      <span key={item.code}>
                        <i className={`legendDot legendDot${index + 1}`} />
                        {item.name}
                      </span>
                    ))}
                  </div>
                  <div className="workspaceDonut" aria-label={`共 ${stats.data.assetCount || assets.data.length} 个资源`}>
                    <span>
                      <strong>{stats.data.assetCount || assets.data.length}</strong>
                      <em>资源总量</em>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="workspaceQuickServices">
              <div className="workspaceSectionHeading">
                <div>
                  <h2>快捷服务</h2>
                  <p>按业务分组展示常用表单与办理入口</p>
                </div>
                <button type="button" onClick={openQuickServices}>查看全部 ›</button>
              </div>
              <QuickServiceGroups
                groups={quickServices.data}
                loading={quickServices.loading}
                error={quickServices.error}
              />
            </section>

            <AssetListPanel
              panelId="all-applications"
              title={selectedTypeName ? `${selectedTypeName}应用` : "全部应用"}
              description={
                selectedTypeName
                  ? `当前共 ${assets.data.length} 个${selectedTypeName}应用`
                  : `查看并访问当前已启用的 ${assetFilterOptions[0]?.count ?? assets.data.length} 个应用`
              }
              keyword={keyword}
              onKeywordChange={setKeyword}
              assets={assets.data}
              alwaysShowPagination
              loading={assets.loading}
              error={assets.error}
              assetTypeMap={assetTypeMap}
              favoriteAssetIds={favoriteAssetIds}
              favoritePendingIds={favoritePendingIds}
              onToggleFavorite={toggleFavoriteAsset}
              typeFilterOptions={assetFilterOptions}
              selectedType={selectedType}
              onSelectType={setSelectedType}
            />

            <section className="workspaceRecommendations">
              <div className="workspaceSectionHeading">
                <div>
                  <h2>应用推荐</h2>
                  <p>为您精选的高频应用与智能工具</p>
                </div>
                <button type="button" onClick={() => setSelectedType(null)}>查看全部 ›</button>
              </div>
              <div className="workspaceRecommendationGrid">
                {recommendedAssets.map((asset, index) => (
                  <article className={`workspaceRecommendationCard recommendationTheme${index + 1}`} key={asset.id}>
                    <a
                      className="workspaceRecommendationVisual"
                      href={asset.url}
                      {...getAssetLinkProps(asset.openMode)}
                      onClick={() => recordAssetOpen(asset.id)}
                    >
                      <span>{getTypeIcon(assetTypeMap.get(asset.type)?.icon)}</span>
                      <i />
                      <i />
                      <i />
                    </a>
                    <div className="workspaceRecommendationCopy">
                      <span>{assetTypeMap.get(asset.type)?.name ?? asset.type}</span>
                      <div className="recommendationNameWithTooltip">
                        <h3>{asset.name}</h3>
                        <span className="assetDescriptionTooltip" role="tooltip">
                          {asset.description || "快速进入业务应用，提升日常协作效率。"}
                        </span>
                      </div>
                      <div className="recommendationActions">
                        <a
                          href={asset.url}
                          {...getAssetLinkProps(asset.openMode)}
                          onClick={() => recordAssetOpen(asset.id)}
                        >
                          立即体验
                        </a>
                        <FavoriteToggleButton
                          active={favoriteAssetIds.has(asset.id)}
                          disabled={favoritePendingIds.has(asset.id)}
                          onToggle={() => toggleFavoriteAsset(asset.id)}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        ) : (
          <section className="workspaceCollectionPage directoryCollectionPage">
            <section className="collectionHero">
              <div className="collectionHeroCopy">
                <h1>{selectedDirectory?.name ?? "目录详情"}</h1>
                <p>{selectedDirectory?.description ?? "当前目录及其子目录下的全部应用入口"}</p>
              </div>
              <div className="collectionHeroMetrics">
                <div>
                  <span>当前应用</span>
                  <strong>{assets.data.length}</strong>
                </div>
                <div>
                  <span>应用类型</span>
                  <strong>{new Set(assets.data.map((asset) => asset.type)).size}</strong>
                </div>
                <div>
                  <span>子目录</span>
                  <strong>
                    {directories.data.filter((directory) => directory.parentId === selectedDirectoryId).length}
                  </strong>
                </div>
              </div>
              <div className="collectionHeroSymbol" aria-hidden="true">▣</div>
            </section>

            <TypeFilterBar
              assetTypes={assetTypes.data}
              selectedType={selectedType}
              onSelectType={setSelectedType}
            />

            <AssetListPanel
              title={selectedTypeName ? `${selectedTypeName}应用` : "应用入口"}
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
