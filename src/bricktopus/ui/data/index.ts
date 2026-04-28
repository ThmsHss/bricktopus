import { MockDataSource } from "./mock-source";
import { RealDataSource } from "./real-source";
import type { DataSource } from "./source";
import type { DataMode } from "./types";

export type { DataSource } from "./source";
export type {
  Anomaly,
  Briefing,
  Contact,
  ConsumptionSnapshot,
  Customer,
  CustomerId,
  DataMode,
  Engagement,
  Meeting,
  NextBestAction,
  OpenTask,
  OverviewBundle,
  ProductStatus,
  SkuShare,
  SpendPoint,
} from "./types";

const sources: Record<DataMode, DataSource> = {
  mock: new MockDataSource(),
  real: new RealDataSource(),
};

export function getDataSource(mode: DataMode): DataSource {
  return sources[mode];
}
