import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/apx/page-stub";
import { Lightbulb } from "lucide-react";

export const Route = createFileRoute("/_sidebar/use-cases")({
  component: () => (
    <PageStub
      icon={Lightbulb}
      title="Use cases"
      blurb="Current UCOs mapped to teams, peer-derived prospect use cases by industry, and ranked recommendations on who to approach next."
    />
  ),
});
