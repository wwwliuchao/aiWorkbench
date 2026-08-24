export type AssetType = string;
export type AssetOpenMode = "current_tab" | "new_tab";

export type AssetTypeDefinition = {
  code: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AssetTypeStat = {
  code: string;
  name: string;
  color: string;
  icon: string | null;
  count: number;
  clickCount: number;
};

export type AssetStats = {
  directoryCount: number;
  assetCount: number;
  clickCount: number;
  rangeClickCount: number;
  startDate: string | null;
  endDate: string | null;
  todayClickCount: number;
  sevenDayClickCount: number;
  thirtyDayClickCount: number;
  typeStats: AssetTypeStat[];
  assetVisitStats: AssetVisitStat[];
  departmentStats: AssetDimensionStat[];
  userStats: AssetDimensionStat[];
  dailyStats: AssetDailyStat[];
};

export type AssetVisitStat = {
  assetId: number;
  clickCount: number;
};

export type AssetDimensionStat = {
  name: string;
  clickCount: number;
};

export type AssetDailyStat = {
  date: string;
  clickCount: number;
};

export type Directory = {
  id: number;
  parentId: number | null;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Asset = {
  id: number;
  directoryId: number;
  type: AssetType;
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
  createdAt: string;
  updatedAt: string;
};

export type EipUserReference = {
  id: string;
  name: string;
  email: string | null;
  departmentId: string | null;
  departmentName: string | null;
};

export type EipDepartmentReference = {
  id: string;
  name: string;
  fullName: string;
  parentId: string | null;
};

export type QuickServiceCard = {
  id: number;
  groupId: number;
  name: string;
  description: string | null;
  url: string;
  openMode: AssetOpenMode;
  icon: string | null;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type QuickServiceGroup = {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  cards: QuickServiceCard[];
};
