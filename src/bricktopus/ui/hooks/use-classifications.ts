import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listOntologyClassifications,
  upsertOntologyClassification,
} from "@/lib/api";
import type { Classification } from "@/lib/classification";
import { useBricktopus } from "@/data/context";

/**
 * Manually-curated person classifications, keyed by person id, scoped to the
 * active customer.
 *
 * Returns an empty record while the request is in flight or on error so
 * downstream components can simply spread the map without null-guards.
 */
export function useClassifications(): {
  classifications: Record<string, Classification>;
  isLoading: boolean;
} {
  const { customerId } = useBricktopus();
  const query = useQuery({
    queryKey: ["ontology-classifications", customerId],
    queryFn: async () => {
      const res = await listOntologyClassifications({ customer_id: customerId });
      // Backend may emit unexpected strings; coerce to our Classification union.
      const out: Record<string, Classification> = {};
      for (const [id, raw] of Object.entries(res.data)) {
        if (raw === "champion" || raw === "supportive" || raw === "blocking") {
          out[id] = raw;
        }
      }
      return out;
    },
    staleTime: 30_000,
  });

  return {
    classifications: query.data ?? {},
    isLoading: query.isPending,
  };
}

interface SetClassificationVars {
  personId: string;
  classification: Classification | null;
}

export function useSetClassification() {
  const { customerId } = useBricktopus();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ personId, classification }: SetClassificationVars) =>
      upsertOntologyClassification(
        { person_id: personId },
        { customer_id: customerId, classification },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ontology-classifications", customerId],
      });
    },
  });
}
