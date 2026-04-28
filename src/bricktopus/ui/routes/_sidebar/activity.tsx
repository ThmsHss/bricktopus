import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/apx/page-stub";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_sidebar/activity")({
  component: () => (
    <PageStub
      icon={Activity}
      title="Activity"
      blurb="Unified Slack, email, and meeting-notes timeline across SA + AE workstreams, with filters, mention search, and signal extraction."
    />
  ),
});
