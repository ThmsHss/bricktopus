import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/apx/page-stub";
import { CheckSquare } from "lucide-react";

export const Route = createFileRoute("/_sidebar/tasks")({
  component: () => (
    <PageStub
      icon={CheckSquare}
      title="Tasks"
      blurb="Tasks parsed from emails and meeting notes, prioritized and routed for automated completion where possible."
    />
  ),
});
