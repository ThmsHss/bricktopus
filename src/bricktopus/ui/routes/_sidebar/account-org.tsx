import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_sidebar/account-org")({
  beforeLoad: () => {
    throw redirect({ to: "/ontology" });
  },
});
