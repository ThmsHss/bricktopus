import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useOverview } from "@/hooks/use-overview";
import { OverviewHeader } from "@/components/overview/overview-header";
import { BriefingCard } from "@/components/overview/briefing-card";
import { NbaCard } from "@/components/overview/nba-card";
import { SpendCard } from "@/components/overview/spend-card";
import { EngagementCard } from "@/components/overview/engagement-card";
import { AnomaliesCard } from "@/components/overview/anomalies-card";
import { TasksCard } from "@/components/overview/tasks-card";
import { TimeSpentCard } from "@/components/overview/time-spent-card";
import { OverviewSkeleton } from "@/components/overview/overview-skeleton";

export const Route = createFileRoute("/_sidebar/overview")({
  component: OverviewRoute,
});

function OverviewRoute() {
  const { data, isPending, error } = useOverview();

  if (isPending) return <OverviewSkeleton />;

  if (error || !data) {
    return (
      <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wider">
            Overview unavailable
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? "No data returned for this customer."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <OverviewHeader
        customer={data.customer}
        generatedAt={data.briefing.generatedAt}
      />
      <TimeSpentCard />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <BriefingCard briefing={data.briefing} />
        </div>
        <div className="col-span-12 lg:col-span-4 lg:row-span-2">
          <NbaCard actions={data.nextBestActions} />
        </div>
        <div className="col-span-12 lg:col-span-8">
          <SpendCard consumption={data.consumption} />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-4">
          <EngagementCard engagement={data.engagement} />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-4">
          <AnomaliesCard anomalies={data.anomalies} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <TasksCard tasks={data.tasks} />
        </div>
      </div>
    </div>
  );
}
