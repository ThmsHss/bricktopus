import { useMemo, useState } from "react";
import { CalendarClock, RefreshCw } from "lucide-react";
import { ReclassifyDialog } from "@/components/overview/reclassify-dialog";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  triggerCalendarSync,
  useTimeSpent,
  type TimeSpentBucket,
  type TimeSpentBucketEntry,
  type TimeSpentResponse,
} from "@/hooks/use-time-spent";

const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const INTERNAL_FILL = "var(--muted-foreground)";

const TYPE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  demo: "Demo",
  cadence: "Cadence",
  "deep-dive": "Deep dive",
  prep: "Prep",
  other: "Other",
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function colorForCustomer(customerId: string): string {
  if (customerId === "internal") return INTERNAL_FILL;
  return CHART_PALETTE[hashString(customerId) % CHART_PALETTE.length];
}

function minutesToHours(minutes: number): string {
  if (!minutes) return "0h";
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1)}h`;
}

function buildChartData(
  buckets: TimeSpentBucketEntry[],
  customerOrder: string[],
): Array<Record<string, number | string>> {
  return buckets.map((bucket) => {
    const row: Record<string, number | string> = {
      label: bucket.bucket_label,
      bucket_start: bucket.bucket_start,
      total: bucket.total_minutes,
    };
    for (const cid of customerOrder) row[cid] = 0;
    for (const entry of bucket.customer_breakdown) {
      row[entry.customer_id] = entry.minutes;
    }
    return row;
  });
}

interface TimeSpentTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  customerNameById: Record<string, string>;
}

function TimeSpentTooltip({
  active,
  payload,
  label,
  customerNameById,
}: TimeSpentTooltipProps) {
  if (!active || !payload?.length) return null;
  const segments = payload
    .filter((p) => Number(p.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value));
  const total = segments.reduce((sum, s) => sum + Number(s.value), 0);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-popover-foreground shadow-lg text-xs min-w-44">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="font-medium">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {minutesToHours(total)}
        </span>
      </div>
      <ul className="space-y-1">
        {segments.map((seg) => (
          <li
            key={seg.name}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: seg.color }}
              />
              {customerNameById[seg.name] ?? seg.name}
            </span>
            <span className="font-mono tabular-nums">
              {minutesToHours(Number(seg.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface LeaderboardProps {
  data: TimeSpentResponse;
}

interface LeaderboardClickProps extends LeaderboardProps {
  onSelect?: (entry: { customer_id: string; customer_name: string }) => void;
}

function CustomerLeaderboard({ data, onSelect }: LeaderboardClickProps) {
  const total = data.total_minutes || 1;
  const top = data.totals_by_customer.slice(0, 5);

  if (!top.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No customer time logged yet.
      </p>
    );
  }

  return (
    <ol className="space-y-2.5">
      {top.map((entry, idx) => {
        const share = entry.minutes / total;
        const interactive = Boolean(onSelect);
        return (
          <li key={entry.customer_id}>
            <button
              type="button"
              onClick={() =>
                onSelect?.({
                  customer_id: entry.customer_id,
                  customer_name: entry.customer_name,
                })
              }
              disabled={!interactive}
              className={`group block w-full space-y-1 rounded-md text-left ${
                interactive
                  ? "cursor-pointer hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none px-1.5 py-1 -mx-1.5"
                  : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground w-4">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate text-sm font-medium group-hover:text-foreground">
                    {entry.customer_name}
                  </span>
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {minutesToHours(entry.minutes)}
                </span>
              </div>
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.max(2, share * 100)}%`,
                    background: colorForCustomer(entry.customer_id),
                  }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

interface TypePillsProps {
  totalsByType: Record<string, number>;
  total: number;
}

function MeetingTypePills({ totalsByType, total }: TypePillsProps) {
  const entries = Object.entries(totalsByType)
    .filter(([, mins]) => mins > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([type, mins]) => {
        const share = total ? Math.round((mins / total) * 100) : 0;
        return (
          <Badge
            key={type}
            variant="outline"
            className="text-[11px] font-normal py-1 px-2 gap-1.5 border-border/80"
          >
            <span className="font-medium">
              {TYPE_LABELS[type] ?? type}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {minutesToHours(mins)}
              <span className="ml-1 text-[10px]">({share}%)</span>
            </span>
          </Badge>
        );
      })}
    </div>
  );
}

interface EmptyStateProps {
  onSync: () => void;
  syncing: boolean;
}

function TimeSpentEmpty({ onSync, syncing }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border/80 bg-muted/30 px-5 py-8">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">No meetings ingested yet</h3>
        <p className="max-w-prose text-xs text-muted-foreground">
          Hit sync to pull this year's calendar into Bricktopus. Mock data
          is used until the Google Calendar MCP is authenticated.
        </p>
      </div>
      <Button size="sm" onClick={onSync} disabled={syncing}>
        <RefreshCw
          className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
        />
        {syncing ? "Syncing…" : "Sync calendar"}
      </Button>
    </div>
  );
}

function TimeSpentCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-3 w-72" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <Skeleton className="h-[260px] w-full" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-3/4" />
            <Skeleton className="h-2.5 w-2/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TimeSpentCard() {
  const [bucket, setBucket] = useState<TimeSpentBucket>("week");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [reclassify, setReclassify] = useState<{
    customer_id: string;
    customer_name: string;
  } | null>(null);
  const { data, isPending, error, refetch } = useTimeSpent({ bucket });

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await triggerCalendarSync();
      await refetch();
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Sync failed",
      );
    } finally {
      setSyncing(false);
    }
  };

  const customerOrder = useMemo(() => {
    if (!data) return [];
    return data.totals_by_customer.map((c) => c.customer_id);
  }, [data]);

  const customerNameById = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(
      data.totals_by_customer.map((c) => [c.customer_id, c.customer_name]),
    );
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return buildChartData(data.buckets, customerOrder);
  }, [data, customerOrder]);

  if (isPending) return <TimeSpentCardSkeleton />;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            Where I spend my time
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <span className="font-medium text-destructive">
              Couldn't load time-spent data
            </span>
            <span className="text-xs text-muted-foreground">
              {error.message}
            </span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const totalHours = data.total_minutes / 60;
  const totalLabel =
    totalHours >= 10 ? `${Math.round(totalHours)}h` : `${totalHours.toFixed(1)}h`;

  const isEmpty = data.buckets.length === 0 || data.event_count === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
              Where I spend my time
            </div>
            <CardTitle className="font-display text-3xl md:text-4xl tracking-tight">
              {totalLabel}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                across {data.event_count} meeting
                {data.event_count === 1 ? "" : "s"}
              </span>
            </CardTitle>
            <CardDescription>
              {data.range_start} → {data.range_end} · grouped by{" "}
              {bucket === "week" ? "ISO week" : "month"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Tabs
              value={bucket}
              onValueChange={(v) => setBucket(v as TimeSpentBucket)}
            >
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSync}
              disabled={syncing}
              aria-label="Sync calendar"
              title="Sync calendar"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
        {syncError && (
          <p className="text-xs text-destructive">Sync failed: {syncError}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {isEmpty ? (
          <TimeSpentEmpty onSync={handleSync} syncing={syncing} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      minutesToHours(Number(value))
                    }
                    fontSize={11}
                    width={40}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    content={
                      <TimeSpentTooltip
                        customerNameById={customerNameById}
                      />
                    }
                  />
                  {customerOrder.map((cid) => (
                    <Bar
                      key={cid}
                      dataKey={cid}
                      stackId="time"
                      fill={colorForCustomer(cid)}
                      radius={
                        cid === customerOrder[customerOrder.length - 1]
                          ? [4, 4, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    >
                      {chartData.map((_, i) => (
                        <Cell key={`${cid}-${i}`} />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Top customers
                </div>
                <CustomerLeaderboard data={data} onSelect={setReclassify} />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Mix by meeting type
                </div>
                <MeetingTypePills
                  totalsByType={data.totals_by_type}
                  total={data.total_minutes}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <ReclassifyDialog
        open={reclassify !== null}
        onOpenChange={(open) => {
          if (!open) setReclassify(null);
        }}
        customerId={reclassify?.customer_id ?? null}
        customerName={reclassify?.customer_name ?? ""}
        start={data.range_start}
        end={data.range_end}
      />
    </Card>
  );
}
