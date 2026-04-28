import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/apx/page-stub";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_sidebar/meetings")({
  component: () => (
    <PageStub
      icon={CalendarDays}
      title="Meetings"
      blurb="Upcoming meetings with bricktopus-generated prep, past meeting summaries, and a relevance flag that pushes back on calls that aren't worth the time."
    />
  ),
});
