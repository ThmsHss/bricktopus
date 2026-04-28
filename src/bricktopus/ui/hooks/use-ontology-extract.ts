import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

/** A single proposed person from the LLM extraction call. */
export interface ExtractedPersonOut {
  name: string | null;
  title: string | null;
  team: string | null;
  manager_name: string | null;
  email: string | null;
  confidence: number;
  ready_to_upsert: boolean;
}

/** End-to-end response shape from `/api/ontology/extract`. */
export interface ExtractionResponseOut {
  model: string;
  people: ExtractedPersonOut[];
  committed: number;
  extraction_id: number;
}

export interface ExtractInput {
  file: File;
  customerId?: string | null;
  /** When true, the backend immediately upserts every person with a valid email. */
  commit?: boolean;
}

/**
 * Posts a multipart upload to /api/ontology/extract and returns the
 * proposed people. Hand-rolled (rather than going through the generated
 * client) because the openapi watcher doesn't run in isolated worktrees
 * and the call uses multipart/form-data, which the generator handles
 * imperfectly anyway.
 */
async function postExtract({
  file,
  customerId,
  commit = false,
}: ExtractInput): Promise<ExtractionResponseOut> {
  const form = new FormData();
  form.append("file", file);
  if (customerId) form.append("customer_id", customerId);
  form.append("commit", commit ? "true" : "false");

  const res = await fetch("/api/ontology/extract", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    throw new ApiError(res.status, res.statusText, parsed);
  }

  return (await res.json()) as ExtractionResponseOut;
}

/** Mutation hook used by the import dialog to run an extraction. */
export function useOntologyExtract() {
  return useMutation<ExtractionResponseOut, ApiError, ExtractInput>({
    mutationFn: postExtract,
  });
}
