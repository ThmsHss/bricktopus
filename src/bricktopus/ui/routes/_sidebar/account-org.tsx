import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/apx/page-stub";
import { Network } from "lucide-react";

export const Route = createFileRoute("/_sidebar/account-org")({
  component: () => (
    <PageStub
      icon={Network}
      title="Account & Org"
      blurb="Customer profile, org chart, who we're engaged with vs. who we should be, and LinkedIn-driven gap detection."
    />
  ),
});
