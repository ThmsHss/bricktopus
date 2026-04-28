import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/apx/page-stub";
import { LineChart } from "lucide-react";

export const Route = createFileRoute("/_sidebar/consumption")({
  component: () => (
    <PageStub
      icon={LineChart}
      title="Consumption"
      blurb="12-month spend with current-month forecast, workspace + SKU breakdown, MAU, Lakebase, Genie, AI/BI, Robin app, plus anomaly drilldowns."
    />
  ),
});
