import { Calendar, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/format";
import type { DailySummary } from "@/hooks/use-plan-my-day";

interface DailySummaryStripProps {
  summary: DailySummary;
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function formatDayHeading(iso: string): string {
  // iso is YYYY-MM-DD; render as "Tue, Apr 28"
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function DailySummaryStrip({ summary }: DailySummaryStripProps) {
  const totalMin = summary.total_meeting_minutes;
  const customerFacing = summary.customer_facing_minutes;

  return (
    <section
      aria-labelledby="plan-day-heading"
      className="relative overflow-hidden rounded-2xl border bg-card"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="grid gap-6 p-6 lg:grid-cols-[2fr_3fr] lg:items-end lg:p-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            Plan my day
          </div>
          <h1
            id="plan-day-heading"
            className="font-serif text-4xl leading-tight tracking-tight"
          >
            {formatDayHeading(summary.day)}
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            {summary.meeting_count === 0
              ? "Nothing on the books — claim it back as deep work."
              : `${summary.meeting_count} ${
                  summary.meeting_count === 1 ? "meeting" : "meetings"
                } today, ${formatHours(totalMin)} total. ${formatPercent(
                  summary.customer_facing_share,
                )} of that is customer-facing.`}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-border/60 lg:grid-cols-3">
          <Stat
            label="Total"
            value={formatHours(totalMin)}
            sub={`${summary.meeting_count} meetings`}
          />
          <Stat
            label="Customer"
            value={formatHours(customerFacing)}
            sub={
              totalMin
                ? formatPercent(customerFacing / totalMin)
                : "—"
            }
            accent
          />
          <Stat
            label="Internal"
            value={formatHours(summary.internal_minutes)}
            sub={
              totalMin
                ? formatPercent(summary.internal_minutes / totalMin)
                : "—"
            }
          />
        </dl>
      </div>

      {summary.customers.length > 0 && (
        <footer className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-6 py-3 lg:px-8">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Users2 className="h-3 w-3" />
            Customers in play
          </div>
          {summary.customers.map((c) => (
            <Badge
              key={c.customer_id}
              variant="outline"
              className="rounded-full border-border bg-background text-xs font-medium"
            >
              {c.customer_name}
              <span className="ml-1.5 text-muted-foreground">
                · {c.meeting_count}
              </span>
            </Badge>
          ))}
        </footer>
      )}
    </section>
  );
}

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

function Stat({ label, value, sub, accent }: StatProps) {
  return (
    <div
      className={`flex flex-col gap-1 px-5 py-4 ${
        accent ? "bg-primary/5" : "bg-card"
      }`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-serif text-2xl tabular-nums ${
          accent ? "text-primary" : ""
        }`}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {sub}
        </span>
      )}
    </div>
  );
}
