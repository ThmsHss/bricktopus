import { useEffect, useState } from "react";
import { AlertCircle, FileText, Loader2, Sparkles } from "lucide-react";
import { useBricktopus } from "@/data/context";
import { useOntologyIngest } from "@/hooks/use-ontology-ingest";
import type { IngestDocOut, IngestedPersonOut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Kind = "gdoc" | "notion";

interface IngestDocDialogProps {
  trigger: React.ReactNode;
}

/**
 * Two-step ingest dialog.
 *
 * Step 1: pick source kind, paste URL/id, hit "Fetch + extract" → calls
 *   /api/ontology/ingest-doc with commit=false.
 * Step 2: review the LLM's person list, click "Save N" → same endpoint
 *   with commit=true, which upserts each person via the canonical path.
 */
export function IngestDocDialog({ trigger }: IngestDocDialogProps) {
  const { customerId } = useBricktopus();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("gdoc");
  const [urlOrId, setUrlOrId] = useState("");
  const [customer, setCustomer] = useState<string>(customerId ?? "");
  const [preview, setPreview] = useState<IngestDocOut | null>(null);

  const ingest = useOntologyIngest();

  // Reset everything when the dialog closes.
  // `ingest` is intentionally excluded from deps — TanStack's mutation
  // object changes identity every render, so depending on it would loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) {
      setUrlOrId("");
      setPreview(null);
      ingest.reset();
    }
  }, [open]);

  // Keep customer in sync when the active customer changes externally.
  useEffect(() => {
    if (!preview) setCustomer(customerId ?? "");
  }, [customerId, preview]);

  const onFetch = async () => {
    const result = await ingest.mutateAsync({
      kind,
      url_or_id: urlOrId.trim(),
      customer_id: customer.trim() || null,
      commit: false,
    });
    setPreview(result.data);
  };

  const readyCount = (preview?.people ?? []).filter(
    (p) => p.ready_to_upsert,
  ).length;

  const onSave = async () => {
    const result = await ingest.mutateAsync({
      kind,
      url_or_id: urlOrId.trim(),
      customer_id: customer.trim() || null,
      commit: true,
    });
    setPreview(result.data);
  };

  const errorDetail = formatError(ingest.error);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-chart-3" />
            Ingest people from a doc
          </DialogTitle>
          <DialogDescription>
            Paste a Google Docs or Notion URL — the model extracts named people
            and queues them for review before they hit the ontology.
          </DialogDescription>
        </DialogHeader>

        {!preview && (
          <FormStep
            kind={kind}
            setKind={setKind}
            urlOrId={urlOrId}
            setUrlOrId={setUrlOrId}
            customer={customer}
            setCustomer={setCustomer}
          />
        )}

        {preview && (
          <PreviewStep preview={preview} committed={preview.committed > 0} />
        )}

        {errorDetail && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{errorDetail}</span>
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {preview ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  ingest.reset();
                }}
                disabled={ingest.isPending}
              >
                Back
              </Button>
              {preview.committed > 0 ? (
                <Button onClick={() => setOpen(false)}>Done</Button>
              ) : (
                <Button
                  onClick={onSave}
                  disabled={ingest.isPending || readyCount === 0}
                >
                  {ingest.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save {readyCount}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={ingest.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={onFetch}
                disabled={ingest.isPending || urlOrId.trim().length === 0}
              >
                {ingest.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Fetch + extract
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────── Step 1: source picker + URL ──────────

interface FormStepProps {
  kind: Kind;
  setKind: (k: Kind) => void;
  urlOrId: string;
  setUrlOrId: (v: string) => void;
  customer: string;
  setCustomer: (v: string) => void;
}

function FormStep({
  kind,
  setKind,
  urlOrId,
  setUrlOrId,
  customer,
  setCustomer,
}: FormStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <KindToggle
          active={kind === "gdoc"}
          onClick={() => setKind("gdoc")}
          label="Google Doc"
        />
        <KindToggle
          active={kind === "notion"}
          onClick={() => setKind("notion")}
          label="Notion page"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ingest-url">URL or id</Label>
        <Input
          id="ingest-url"
          value={urlOrId}
          onChange={(e) => setUrlOrId(e.target.value)}
          placeholder={
            kind === "gdoc"
              ? "https://docs.google.com/document/d/..."
              : "https://www.notion.so/..."
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ingest-customer">Customer (optional)</Label>
        <Input
          id="ingest-customer"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="leave blank to skip customer hint"
        />
        <p className="text-xs text-muted-foreground">
          Used both as the LLM hint and the customer_id stamped on each new
          person row.
        </p>
      </div>
    </div>
  );
}

function KindToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-chart-3/50 bg-chart-3/10 text-chart-3"
          : "border-border bg-card text-muted-foreground hover:bg-accent/40",
      )}
    >
      <FileText className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ────────── Step 2: review ──────────

function PreviewStep({
  preview,
  committed,
}: {
  preview: IngestDocOut;
  committed: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{preview.people.length}</strong>{" "}
          candidate{preview.people.length === 1 ? "" : "s"}
        </span>
        <span>
          <strong className="text-foreground">{preview.doc_chars}</strong>{" "}
          chars fetched
        </span>
        <span>
          model{" "}
          <strong className="font-mono text-[11px] text-foreground">
            {preview.model}
          </strong>
        </span>
        {committed ? (
          <span className="text-chart-3">
            Saved {preview.committed} to the ontology.
          </span>
        ) : null}
      </div>
      <div className="max-h-80 overflow-y-auto rounded-md border">
        {preview.people.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No people identified in this doc.
          </div>
        ) : (
          <ul className="divide-y">
            {preview.people.map((p, i) => (
              <PreviewRow key={i} person={p} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PreviewRow({ person }: { person: IngestedPersonOut }) {
  return (
    <li className="flex items-start gap-3 px-3 py-2 text-sm">
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{person.name ?? "(no name)"}</span>
          <span className="text-xs text-muted-foreground">
            {person.title ?? ""}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {person.email ?? "no email"}
          {person.team ? ` · ${person.team}` : ""}
          {person.manager_name ? ` · reports to ${person.manager_name}` : ""}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2 self-center">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {Math.round(person.confidence * 100)}%
        </span>
        {person.ready_to_upsert ? (
          <span className="rounded-full bg-chart-3/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-chart-3">
            ready
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            no email
          </span>
        )}
      </div>
    </li>
  );
}

// ────────── helpers ──────────

function formatError(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === "object" && err !== null && "body" in err) {
    const body = (err as { body?: unknown }).body;
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
