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

/* ─── Ontology ─────────────────────────────────────────────────────────── */

export type PersonaType =
  | "champion"
  | "ally"
  | "explorer"
  | "skeptic"
  | "blocker"
  | "unknown";

export interface Persona {
  type: PersonaType;
  summary: string;
  motivations: string[];
  communicationStyle?: string;
}

export type OrgUnitGroup = "Executive" | "Central IT" | "Business Unit";

export interface OrgUnit {
  id: string;
  name: string;
  group: OrgUnitGroup;
  description?: string;
  /** Display order within its group, low first. */
  order?: number;
}

export interface OrgPerson {
  id: string;
  name: string;
  title: string;
  team: string;
  /** Which org unit (BU, Central IT lane, or Executive) this person sits in. */
  orgUnitId: string;
  reportsTo: string | null;
  persona: Persona;
  supportRating: number; // 0–5: how supportive of Databricks
  connectionStrength: number; // 0–5: how strong our relationship is
  lastInteractionDays: number | null;
  linkedinUrl?: string;
  notes?: string;
  /** Marks roles we've identified as a gap (no real engagement yet). */
  isGapRole?: boolean;
  workspaceIds?: string[];
  useCaseIds?: string[];
  meetingNoteIds?: string[];
}

export interface OntologyWorkspace {
  id: string;
  name: string;
  environment: "prod" | "dev" | "sandbox";
  region: string;
  ownerId?: string;
  primaryUserIds: string[];
  description?: string;
}

export type UseCaseStatus = "Live" | "In flight" | "Pilot" | "Aspirational";

export interface OntologyUseCase {
  id: string;
  name: string;
  status: UseCaseStatus;
  sponsorIds: string[];
  valueChainFunction: string;
  primarySku?: string;
  description?: string;
  /** Workspaces this use case runs on. */
  workspaceIds?: string[];
}

export interface MeetingNoteSummary {
  id: string;
  title: string;
  date: string;
  attendeeIds: string[];
  summary: string;
  lessons: string[];
  externalUrl?: string;
}

export interface ValueChainFunction {
  id: string;
  name: string;
  description: string;
  expectedRoles: string[];
  /** ids of OrgPerson covering this function (may be empty if it's a gap). */
  coveredBy: string[];
  importance: "core" | "supporting" | "emerging";
}

export interface PeerSignal {
  function: string;
  peerCoverage: string;
  ourCoverage: string;
  hint: string;
  intensity: "high" | "medium" | "low";
}

export interface PeerBenchmark {
  peer: string;
  industry: string;
  relationship: "industry-peer" | "buy-side-peer" | "neighbor";
  signals: PeerSignal[];
}

export interface OntologyBundle {
  customerId: CustomerId;
  orgUnits: OrgUnit[];
  persons: OrgPerson[];
  workspaces: OntologyWorkspace[];
  useCases: OntologyUseCase[];
  meetingNotes: MeetingNoteSummary[];
  valueChain: ValueChainFunction[];
  peers: PeerBenchmark[];
}
