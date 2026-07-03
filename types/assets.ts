export type AssetType = string;

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
  ownerName: string | null;
  departmentName: string | null;
  url: string;
  tags: string[];
  clickCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
