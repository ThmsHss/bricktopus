import type { OverviewBundle } from "../types";

export const pumaOverview: OverviewBundle = {
  customer: {
    id: "puma",
    name: "PUMA",
    industry: "Retail & Apparel",
    region: "EMEA",
    hq: "Herzogenaurach, Germany",
    segment: "Enterprise",
    lifecycleStage: "Expand",
    accountTeam: [
      {
        name: "Anna Müller",
        role: "AE",
        email: "anna.mueller@databricks.com",
      },
      {
        name: "Marco Rossi",
        role: "SA",
        email: "marco.rossi@databricks.com",
      },
      {
        name: "Yuki Tanaka",
        role: "DSA",
        email: "yuki.tanaka@databricks.com",
      },
      {
        name: "Sven Berg",
        role: "TAM",
        email: "sven.berg@databricks.com",
      },
    ],
  },
  briefing: {
    generatedAt: "2026-04-28T07:00:00Z",
    headline: "Two consumption anomalies and a likely pricing-driven expansion lever",
    summary:
      "PUMA shipped a new identity stitching pipeline last week, driving a 31% week-over-week jump in DLT serverless spend. The pilot Genie space for the merchandising team has not been touched in 12 days — worth a nudge before today's QBR prep call. A clear opening exists to position Lakebase for the product catalog cache; the data platform team raised latency complaints in Slack on Friday.",
    highlights: [
      "DLT serverless +31% WoW — confirm intentional vs. runaway",
      "Genie merch-pilot dormant 12 days — re-engage before pilot review",
      "Lakebase opening: catalog cache latency in #puma-data-platform",
    ],
  },
  consumption: {
    monthlyUsd: [
      { month: "May 2025", amountUsd: 118000 },
      { month: "Jun 2025", amountUsd: 124500 },
      { month: "Jul 2025", amountUsd: 131200 },
      { month: "Aug 2025", amountUsd: 129800 },
      { month: "Sep 2025", amountUsd: 142100 },
      { month: "Oct 2025", amountUsd: 154300 },
      { month: "Nov 2025", amountUsd: 161900 },
      { month: "Dec 2025", amountUsd: 158400 },
      { month: "Jan 2026", amountUsd: 167200 },
      { month: "Feb 2026", amountUsd: 172800 },
      { month: "Mar 2026", amountUsd: 179600 },
      { month: "Apr 2026", amountUsd: 188400, forecast: true },
    ],
    skuBreakdown: [
      { sku: "Jobs Compute", amountUsd: 71200, share: 0.4, trend: "up" },
      { sku: "DLT Serverless", amountUsd: 41800, share: 0.235, trend: "up" },
      { sku: "DBSQL Serverless", amountUsd: 38200, share: 0.215, trend: "up" },
      { sku: "All-Purpose", amountUsd: 17600, share: 0.099, trend: "flat" },
      { sku: "Mosaic AI", amountUsd: 9700, share: 0.054, trend: "up" },
      { sku: "Other", amountUsd: 1100, share: 0.006, trend: "flat" },
    ],
    productStatus: [
      {
        product: "Workflows",
        status: "Production",
        health: "healthy",
        note: "1.2k jobs / day, p99 SLO holding",
      },
      {
        product: "DLT",
        status: "Production",
        health: "watch",
        note: "Serverless adoption +31% WoW — verify intent",
      },
      {
        product: "DBSQL",
        status: "Production",
        health: "healthy",
        note: "Robin app revenue dashboard daily-refresh",
      },
      {
        product: "Genie",
        status: "Pilot",
        health: "at-risk",
        note: "Merch space inactive 12d; re-engage Anita's team",
      },
      {
        product: "Lakebase",
        status: "Not adopted",
        health: "watch",
        note: "Latency pain on catalog cache → strong opening",
      },
      {
        product: "AI/BI",
        status: "POC",
        health: "healthy",
        note: "Genie + dashboard handoff demoed at March EBC",
      },
      {
        product: "Mosaic AI",
        status: "Pilot",
        health: "watch",
        note: "Recommendation model serving deferred to Q3",
      },
    ],
    monthlyActiveUsers: 412,
    workspaceCount: 4,
  },
  anomalies: [
    {
      id: "a1",
      detectedAt: "2026-04-26T14:12:00Z",
      severity: "warning",
      title: "DLT serverless spend +31% WoW",
      description:
        "Driven by new identity stitching pipeline in the EU prod workspace. Confirm intent vs. runaway compute before Friday's review.",
      metric: "DLT Serverless DBU",
      delta: "+31%",
    },
    {
      id: "a2",
      detectedAt: "2026-04-22T08:04:00Z",
      severity: "warning",
      title: "Genie merch-pilot dormant",
      description:
        "Zero queries in 12 days. Pilot review with Anita's team is on May 8 — needs a nudge to avoid a quiet death.",
      metric: "Genie queries",
      delta: "−100%",
    },
    {
      id: "a3",
      detectedAt: "2026-04-19T19:40:00Z",
      severity: "info",
      title: "DBSQL Serverless query p95 improved",
      description:
        "p95 latency moved from 2.1s to 1.4s after warehouse autoscale change. Worth flagging in next QBR.",
      metric: "DBSQL p95 latency",
      delta: "−33%",
    },
  ],
  tasks: [
    {
      id: "t1",
      title: "Send executive summary slide to Anna for Wed exec sync",
      source: "email",
      dueDate: "2026-04-29",
      owner: "Marco Rossi",
      priority: "p0",
      status: "in_progress",
    },
    {
      id: "t2",
      title: "Schedule technical deep-dive with PUMA data platform team on Lakebase",
      source: "slack",
      dueDate: "2026-05-02",
      owner: "Yuki Tanaka",
      priority: "p1",
      status: "open",
    },
    {
      id: "t3",
      title: "Follow up on Genie merch-pilot with Anita's team",
      source: "meeting",
      dueDate: "2026-04-30",
      owner: "Marco Rossi",
      priority: "p1",
      status: "open",
    },
    {
      id: "t4",
      title: "Confirm DLT serverless cost spike is intentional",
      source: "manual",
      dueDate: "2026-04-28",
      owner: "Sven Berg",
      priority: "p0",
      status: "open",
    },
    {
      id: "t5",
      title: "Draft Q2 expansion proposal: Lakebase + Mosaic recsys",
      source: "salesforce",
      dueDate: "2026-05-15",
      owner: "Anna Müller",
      priority: "p2",
      status: "open",
    },
  ],
  nextBestActions: [
    {
      id: "nba1",
      headline: "Pitch Lakebase POC for the product catalog cache",
      rationale:
        "Catalog latency was raised twice in #puma-data-platform last week. Their architecture today bolts Postgres onto a separate VPC — Lakebase removes the seam.",
      estimatedImpact: "+ $40-60k ARR within Q3 if POC converts",
      confidence: "high",
      category: "expand",
      evidence: [
        "Slack: 2 latency complaints (Apr 18, Apr 22)",
        "Architecture interview: external Postgres = operational toil",
        "Industry peer (adidas) ran the same play in Q1",
      ],
    },
    {
      id: "nba2",
      headline: "Re-energize the Genie merchandising pilot",
      rationale:
        "12-day inactivity gap puts the May 8 pilot review at risk. A targeted enablement session with Anita's team is cheap insurance.",
      estimatedImpact: "Protects $25k of ARR + opens AI/BI expansion",
      confidence: "high",
      category: "adopt",
      evidence: [
        "Logfood: 0 queries in 12 days",
        "Anita's last note: 'team busy with peak season'",
      ],
    },
    {
      id: "nba3",
      headline: "Highlight DBSQL p95 win in May QBR opening",
      rationale:
        "33% latency improvement is a concrete value moment. Lead the QBR with it before pivoting to expansion asks.",
      estimatedImpact: "QBR tone-setter; primes expansion conversation",
      confidence: "medium",
      category: "renew",
      evidence: [
        "Logfood: p95 2.1s → 1.4s after autoscale tune",
        "Anna noted on March 28: 'CFO wants concrete wins this QBR'",
      ],
    },
  ],
  engagement: {
    contacts: [
      {
        name: "Anita Schmidt",
        title: "VP, Merchandising Analytics",
        team: "Merchandising",
        engagement: "warm",
        lastInteractionDays: 12,
      },
      {
        name: "Felix Hoffmann",
        title: "Head of Data Platform",
        team: "Data Platform",
        engagement: "champion",
        lastInteractionDays: 3,
      },
      {
        name: "Lina Park",
        title: "Director, Customer Data",
        team: "CDP",
        engagement: "warm",
        lastInteractionDays: 8,
      },
      {
        name: "Tom Becker",
        title: "Lead Data Engineer, eCom",
        team: "eCommerce",
        engagement: "cold",
        lastInteractionDays: 47,
      },
      {
        name: "Helena Vogel",
        title: "VP, Supply Chain Tech",
        team: "Supply Chain",
        engagement: "cold",
        lastInteractionDays: null,
      },
    ],
    coveredTeams: ["Data Platform", "Merchandising", "CDP", "Finance Analytics"],
    gapTeams: ["Supply Chain", "Retail Stores", "Marketing Tech", "HR Analytics"],
  },
  meetings: [
    {
      id: "m1",
      title: "PUMA ↔ Databricks weekly sync",
      startsAt: "2026-04-29T13:00:00Z",
      attendees: ["Anna Müller", "Felix Hoffmann", "Marco Rossi"],
      preparedness: "ready",
      preparedNotes:
        "Lead with DBSQL p95 win, then flag DLT spike, close with Lakebase POC ask.",
    },
    {
      id: "m2",
      title: "Lakebase architecture deep-dive",
      startsAt: "2026-05-02T09:00:00Z",
      attendees: ["Felix Hoffmann", "Tom Becker", "Yuki Tanaka"],
      preparedness: "needs_prep",
      preparedNotes:
        "Need a tailored architecture deck. Reuse adidas pattern, swap retail catalog example.",
    },
    {
      id: "m3",
      title: "Genie merchandising pilot review",
      startsAt: "2026-05-08T14:30:00Z",
      attendees: ["Anita Schmidt", "Marco Rossi"],
      preparedness: "needs_prep",
    },
    {
      id: "m4",
      title: "Internal: Robin app onboarding (skip suggestion)",
      startsAt: "2026-04-30T16:00:00Z",
      attendees: ["Anna Müller"],
      preparedness: "skip_recommended",
      preparedNotes:
        "AE-only enablement. Recommend declining or sending a delegate — no customer signal.",
    },
  ],
};
