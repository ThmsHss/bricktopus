import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ConsumptionSnapshot } from "@/data";
import { formatPercent, formatUsdCompact } from "@/lib/format";

interface SpendCardProps {
  consumption: ConsumptionSnapshot;
}

interface SpendDatum {
  month: string;
  amount: number;
  forecast: boolean;
  label: string;
}

interface SpendTooltipProps {
  active?: boolean;
  payload?: { payload: SpendDatum }[];
}

function SpendTooltip({ active, payload }: SpendTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg text-xs">
      <div className="font-medium">
        {point.label}
        {point.forecast && (
          <span className="ml-1.5 text-[10px] uppercase tracking-wider text-primary">
            forecast
          </span>
        )}
      </div>
      <div className="mt-1 font-mono text-sm tabular-nums">
        {formatUsdCompact(point.amount)}
      </div>
    </div>
  );
}

export function SpendCard({ consumption }: SpendCardProps) {
  const series: SpendDatum[] = consumption.monthlyUsd.map((p) => ({
    month: p.month.split(" ")[0],
    amount: p.amountUsd,
    forecast: p.forecast === true,
    label: p.month,
  }));

  const actuals = series.filter((s) => !s.forecast);
  const last = actuals.at(-1);
  const yearAgo = actuals.length >= 12 ? actuals.at(-12) : actuals[0];
  const yoy =
    last && yearAgo && yearAgo.amount
      ? (last.amount - yearAgo.amount) / yearAgo.amount
      : 0;

  const forecastIndex = series.findIndex((s) => s.forecast);
  const lastActualMonth =
    forecastIndex > 0 ? series[forecastIndex - 1].month : undefined;
  const forecastMonth =
    forecastIndex >= 0 ? series[forecastIndex].month : undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Spend trend
            </div>
            <CardTitle className="font-serif text-2xl">
              {last ? formatUsdCompact(last.amount) : "—"}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                this month
              </span>
            </CardTitle>
            <CardDescription>
              Forecast {forecastMonth ?? "—"} ·{" "}
              <span
                className={
                  yoy >= 0
                    ? "text-success font-medium"
                    : "text-destructive font-medium"
                }
              >
                {yoy >= 0 ? "+" : ""}
                {formatPercent(yoy)} YoY
              </span>
            </CardDescription>
          </div>
          <div className="hidden md:flex flex-col items-end gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Workspaces
            </span>
            <span className="font-serif text-2xl">
              {consumption.workspaceCount}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatUsdCompact(v as number)}
                fontSize={11}
                width={48}
                stroke="var(--muted-foreground)"
              />
              {lastActualMonth && forecastMonth && (
                <ReferenceArea
                  x1={lastActualMonth}
                  x2={forecastMonth}
                  strokeOpacity={0}
                  fill="var(--muted)"
                  fillOpacity={0.5}
                />
              )}
              <Tooltip content={<SpendTooltip />} cursor={{ stroke: "var(--border)" }} />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#spendFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
