import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Sunrise,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlanMyDay } from "@/hooks/use-plan-my-day";
import { DailySummaryStrip, MeetingCard } from "@/components/plan-my-day";

interface PlanMyDaySearch {
  day?: string;
}

export const Route = createFileRoute("/_sidebar/plan-my-day")({
  validateSearch: (search: Record<string, unknown>): PlanMyDaySearch => ({
    day: typeof search.day === "string" ? search.day : undefined,
  }),
  component: PlanMyDayRoute,
});

function PlanMyDayRoute() {
  const { day } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isPending, error } = usePlanMyDay(day);

  const goto = (next: string | undefined) => {
    navigate({ search: () => ({ day: next }) });
  };
  const shift = (delta: number) => {
    const base = day ? new Date(day) : new Date();
    base.setUTCDate(base.getUTCDate() + delta);
    goto(base.toISOString().slice(0, 10));
  };

  if (isPending) return <PlanMyDaySkeleton />;

  if (error || !data) {
    return (
      <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wider">
            Plan unavailable
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {error?.message ??
            "Couldn't fetch today's briefing. Try refreshing in a moment."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => shift(-1)}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3"
          onClick={() => goto(undefined)}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => shift(1)}
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {day ?? "today"}
        </span>
      </div>

      <DailySummaryStrip summary={data.summary} />

      {data.notes.length > 0 && (
        <ul className="rounded-md border border-dashed bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          {data.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {data.meetings.length === 0 ? (
        <EmptyDay onJumpToSample={() => goto("2026-04-03")} />
      ) : (
        <section
          aria-label="Today's meetings"
          className="flex flex-col gap-4"
        >
          {data.meetings.map((m) => (
            <MeetingCard key={m.id} item={m} />
          ))}
        </section>
      )}
    </div>
  );
}

function EmptyDay({ onJumpToSample }: { onJumpToSample: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 border-dashed bg-muted/20 p-12 text-center">
      <CalendarOff className="h-8 w-8 text-muted-foreground/60" />
      <h2 className="font-display text-2xl">A clear runway</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Nothing on the calendar for this day. Use the time for a deep-work
        block or batch through the inbox.
      </p>
      <Button variant="outline" size="sm" onClick={onJumpToSample}>
        Jump to sample data (Apr 3)
      </Button>
    </Card>
  );
}

function PlanMyDaySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-3 w-80" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-6 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ))}
      <p className="sr-only">
        <Sunrise /> loading plan my day
      </p>
    </div>
  );
}
