import { useQuery } from "@tanstack/react-query";
import { useBricktopus } from "@/data/context";
import type { OntologyBundle, OverviewBundle } from "@/data";

export function useOverview() {
  const { source, customerId, mode } = useBricktopus();
  return useQuery<OverviewBundle, Error>({
    queryKey: ["overview", mode, customerId],
    queryFn: () => source.getOverview(customerId),
    staleTime: 30_000,
  });
}

export function useOntology() {
  const { source, customerId, mode } = useBricktopus();
  return useQuery<OntologyBundle, Error>({
    queryKey: ["ontology", mode, customerId],
    queryFn: () => source.getOntology(customerId),
    staleTime: 30_000,
  });
}

export function useCustomers() {
  const { source, mode } = useBricktopus();
  return useQuery({
    queryKey: ["customers", mode],
    queryFn: () => source.listCustomers(),
    staleTime: 60_000,
  });
}
