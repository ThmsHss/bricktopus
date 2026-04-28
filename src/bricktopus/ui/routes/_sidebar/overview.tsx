import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/apx/page-stub";
import { LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_sidebar/overview")({
  component: OverviewRoute,
});

function OverviewRoute() {
  return (
    <PageStub
      icon={LayoutDashboard}
      title="Overview"
      blurb="At-a-glance signal across spend, engagement, anomalies, tasks, and the next best moves the account team should make this week."
    />
  );
}
