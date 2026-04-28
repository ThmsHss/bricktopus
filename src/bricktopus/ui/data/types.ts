/**
 * Domain types for the Bricktopus dashboard.
 *
 * These describe the shape of the data the UI consumes regardless of source
 * (mock fixtures today, real Salesforce / Logfood / Slack / Glean / Drive
 * adapters later).
 */

export type CustomerId = "puma" | (string & {});

export interface Customer {
  id: CustomerId;
  name: string;
  industry: string;
  region: string;
  hq: string;
  segment: "Enterprise" | "Mid-Market" | "Strategic";
  accountTeam: AccountTeamMember[];
  lifecycleStage: "Land" | "Adopt" | "Expand" | "Renew";
}

export interface AccountTeamMember {
  name: string;
  role: "AE" | "SA" | "DSA" | "TAM" | "RD" | "GeoLead";
  email: string;
  avatarUrl?: string;
}

export interface SpendPoint {
  month: string;
  amountUsd: number;
  forecast?: boolean;
}

export interface SkuShare {
  sku: string;
  amountUsd: number;
  share: number;
  trend: "up" | "down" | "flat";
}

export interface ProductStatus {
  product:
    | "Workflows"
    | "DLT"
    | "DBSQL"
    | "Genie"
    | "Lakebase"
    | "AI/BI"
    | "Mosaic AI";
  status: "Production" | "Pilot" | "POC" | "Not adopted";
  health: "healthy" | "watch" | "at-risk";
  note: string;
}

export interface ConsumptionSnapshot {
  monthlyUsd: SpendPoint[];
  skuBreakdown: SkuShare[];
  productStatus: ProductStatus[];
  monthlyActiveUsers: number;
  workspaceCount: number;
}

export interface Anomaly {
  id: string;
  detectedAt: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  metric: string;
  delta: string;
}

export interface OpenTask {
  id: string;
  title: string;
  source: "email" | "slack" | "meeting" | "salesforce" | "manual";
  dueDate: string;
  owner: string;
  priority: "p0" | "p1" | "p2";
  status: "open" | "in_progress" | "blocked";
}

export interface NextBestAction {
  id: string;
  headline: string;
  rationale: string;
  estimatedImpact: string;
  confidence: "high" | "medium" | "low";
  category: "land" | "adopt" | "expand" | "renew";
  evidence: string[];
}

export interface Briefing {
  generatedAt: string;
  headline: string;
  summary: string;
  highlights: string[];
}

export interface Contact {
  name: string;
  title: string;
  team: string;
  engagement: "warm" | "cold" | "champion" | "blocker";
  lastInteractionDays: number | null;
}

export interface Engagement {
  contacts: Contact[];
  coveredTeams: string[];
  gapTeams: string[];
}

export interface Meeting {
  id: string;
  title: string;
  startsAt: string;
  attendees: string[];
  preparedness: "ready" | "needs_prep" | "skip_recommended";
  preparedNotes?: string;
}

export interface OverviewBundle {
  customer: Customer;
  briefing: Briefing;
  consumption: ConsumptionSnapshot;
  anomalies: Anomaly[];
  tasks: OpenTask[];
  nextBestActions: NextBestAction[];
  engagement: Engagement;
  meetings: Meeting[];
}

export type DataMode = "mock" | "real";
