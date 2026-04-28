import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ingestDoc,
  type ApiError,
  type IngestDocIn,
  type IngestDocOut,
} from "@/lib/api";

/**
 * Ingest a Google Doc or Notion page into the OrgPerson table.
 *
 * Two-step UX:
 *   1) call with `commit=false` → review the LLM's people list
 *   2) call again with `commit=true` → upsert each person with a valid email
 *
 * On a committed run, invalidates the persons / ontology queries so the
 * canvas picks up the new rows.
 */
export function useOntologyIngest() {
  const qc = useQueryClient();
  return useMutation<{ data: IngestDocOut }, ApiError, IngestDocIn>({
    mutationFn: (vars) => ingestDoc(vars),
    onSuccess: (_data, vars) => {
      if (vars.commit) {
        qc.invalidateQueries({ queryKey: ["/api/ontology/persons"] });
        qc.invalidateQueries({ queryKey: ["ontology"] });
        qc.invalidateQueries({ queryKey: ["overview"] });
      }
    },
  });
}
