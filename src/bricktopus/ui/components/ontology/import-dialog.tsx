import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  Sparkles,
  Square,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ApiError, upsertOrgPerson, useConnectLlmKey } from "@/lib/api";
import { DropZone } from "./drop-zone";
import {
  useOntologyExtract,
  type ExtractedPersonOut,
} from "@/hooks/use-ontology-extract";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled customer hint; defaults to whatever the user has selected. */
  defaultCustomerId?: string;
  /** Fires after a successful save so the parent can refresh dependent data. */
  onImported?: () => void;
}

/** A row in the review table. The user can edit the email and toggle `selected`. */
interface ReviewRow {
  id: string;
  name: string | null;
  title: string | null;
  team: string | null;
  manager_name: string | null;
  email: string;
  confidence: number;
  selected: boolean;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function buildRows(people: ExtractedPersonOut[]): ReviewRow[] {
  return people.map((p, idx) => ({
    id: `${idx}`,
    name: p.name,
    title: p.title,
    team: p.team,
    manager_name: p.manager_name,
    email: p.email ?? "",
    confidence: p.confidence,
    selected: p.ready_to_upsert,
  }));
}

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function ImportDialog({
  open,
  onOpenChange,
  defaultCustomerId,
  onImported,
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);

  const extract = useOntologyExtract();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Reset whenever the dialog re-opens.
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setRows([]);
    setModel(null);
    setMissingKey(false);
    setSaving(false);
    setCustomerId(defaultCustomerId ?? "");
    extract.reset();
    // We deliberately don't include the mutation object in deps — it
    // is a stable reference from `useMutation`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCustomerId]);

  const stage: "pick" | "review" =
    rows.length > 0 || extract.isSuccess ? "review" : "pick";

  const eligibleCount = useMemo(
    () => rows.filter((r) => r.selected && isValidEmail(r.email)).length,
    [rows],
  );

  function onPickExtract() {
    if (!file) return;
    extract.mutate(
      {
        file,
        customerId: customerId.trim() || null,
        commit: false,
      },
      {
        onSuccess: (data) => {
          setRows(buildRows(data.people));
          setModel(data.model);
          if (data.people.length === 0) {
            toast.info("No people detected in that file.");
          }
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 503) {
            setMissingKey(true);
            return;
          }
          toast.error(`Extraction failed: ${err.message}`);
        },
      },
    );
  }

  async function onSaveSelected() {
    const eligible = rows.filter((r) => r.selected && isValidEmail(r.email));
    if (eligible.length === 0) {
      toast.error("Select at least one row with a valid email.");
      return;
    }

    setSaving(true);
    const trimmedCustomer = customerId.trim() || null;
    // Per-row upserts so user-deselected rows stay out of the ontology.
    // `upsertOrgPerson` is idempotent on email, so retries are safe.
    const results = await Promise.allSettled(
      eligible.map((row) =>
        upsertOrgPerson({
          email: row.email.trim().toLowerCase(),
          name: row.name,
          title: row.title,
          team: row.team,
          customer_id: trimmedCustomer,
          source: file?.type === "application/pdf" ? "pdf_upload" : "image_upload",
          extraction_confidence: row.confidence,
        }),
      ),
    );
    setSaving(false);

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;

    if (ok > 0) {
      toast.success(
        `Saved ${ok} ${ok === 1 ? "person" : "people"} to the ontology.`,
      );
      queryClient.invalidateQueries({
        queryKey: ["/api/ontology/persons"],
      });
      onImported?.();
    }
    if (failed > 0) {
      toast.error(
        `${failed} row${failed === 1 ? "" : "s"} failed to save — see console.`,
      );
      results
        .filter((r) => r.status === "rejected")
        .forEach((r) => {
          if (r.status === "rejected") {
            // eslint-disable-next-line no-console
            console.error("upsert failed:", r.reason);
          }
        });
    }
    if (ok > 0 && failed === 0) {
      onOpenChange(false);
    }
  }

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Import people from a screenshot or PDF
          </DialogTitle>
          <DialogDescription>
            Drop an org chart, slide, or LinkedIn export. Bricktopus extracts
            the people, you review, then save.
          </DialogDescription>
        </DialogHeader>

        {missingKey ? (
          <ConnectKeyPanel
            onConnected={() => {
              setMissingKey(false);
              extract.reset();
            }}
          />
        ) : stage === "pick" ? (
          <PickStage
            file={file}
            onFileChange={setFile}
            customerId={customerId}
            onCustomerIdChange={setCustomerId}
            onExtract={onPickExtract}
            isPending={extract.isPending}
          />
        ) : (
          <ReviewStage
            rows={rows}
            model={model}
            onChangeRow={updateRow}
            onResetFile={() => {
              setRows([]);
              setFile(null);
              extract.reset();
            }}
          />
        )}

        {stage === "review" && !missingKey && (
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {eligibleCount} of {rows.length} ready to save
              {model ? ` · ${model}` : null}
            </div>
            <Button
              onClick={onSaveSelected}
              disabled={eligibleCount === 0 || saving}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-4 w-4" />
              )}
              Save {eligibleCount} {eligibleCount === 1 ? "person" : "people"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PickStageProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  customerId: string;
  onCustomerIdChange: (next: string) => void;
  onExtract: () => void;
  isPending: boolean;
}

function PickStage({
  file,
  onFileChange,
  customerId,
  onCustomerIdChange,
  onExtract,
  isPending,
}: PickStageProps) {
  return (
    <div className="space-y-4">
      <DropZone file={file} onFileChange={onFileChange} disabled={isPending} />
      <div className="space-y-1.5">
        <Label htmlFor="extract-customer">Customer (optional)</Label>
        <Input
          id="extract-customer"
          placeholder="e.g. puma"
          value={customerId}
          onChange={(e) => onCustomerIdChange(e.target.value)}
          autoComplete="off"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Bricktopus passes this as a hint to the model and tags every saved
          person with this customer.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={onExtract} disabled={!file || isPending}>
          {isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-4 w-4" />
          )}
          Extract people
        </Button>
      </DialogFooter>
    </div>
  );
}

interface ReviewStageProps {
  rows: ReviewRow[];
  model: string | null;
  onChangeRow: (id: string, patch: Partial<ReviewRow>) => void;
  onResetFile: () => void;
}

function ReviewStage({
  rows,
  model,
  onChangeRow,
  onResetFile,
}: ReviewStageProps) {
  if (rows.length === 0) {
    return (
      <div className="space-y-3 py-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          No people came back from this file.
          {model ? <> ({model})</> : null}
        </div>
        <Button variant="outline" size="sm" onClick={onResetFile}>
          Try another file
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>Review · {rows.length} proposed</span>
        <button
          type="button"
          onClick={onResetFile}
          className="text-foreground/70 hover:text-foreground hover:underline"
        >
          Use a different file
        </button>
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-lg border">
        <div className="grid grid-cols-[28px_1.4fr_1fr_1.6fr_72px] gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span></span>
          <span>Name · title</span>
          <span>Team</span>
          <span>Email</span>
          <span className="text-right">Conf.</span>
        </div>
        {rows.map((row) => (
          <ReviewRowItem key={row.id} row={row} onChange={onChangeRow} />
        ))}
      </div>
    </div>
  );
}

interface ReviewRowItemProps {
  row: ReviewRow;
  onChange: (id: string, patch: Partial<ReviewRow>) => void;
}

function ReviewRowItem({ row, onChange }: ReviewRowItemProps) {
  const emailValid = isValidEmail(row.email);
  const canToggle = emailValid;
  const confidencePct = Math.round((row.confidence ?? 0) * 100);

  return (
    <div
      className={cn(
        "grid grid-cols-[28px_1.4fr_1fr_1.6fr_72px] items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0",
        row.selected && canToggle ? "bg-primary/[0.03]" : null,
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (!canToggle) return;
          onChange(row.id, { selected: !row.selected });
        }}
        disabled={!canToggle}
        aria-pressed={row.selected && canToggle}
        aria-label={row.selected ? "Deselect" : "Select"}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border transition-colors",
          row.selected && canToggle
            ? "border-primary bg-primary text-primary-foreground"
            : "border-foreground/20 bg-background hover:border-foreground/40",
          !canToggle && "cursor-not-allowed opacity-40",
        )}
      >
        {row.selected && canToggle ? (
          <Check className="h-3 w-3" />
        ) : (
          <Square className="h-3 w-3 opacity-0" />
        )}
      </button>

      <div className="min-w-0">
        <div className="truncate font-medium">{row.name ?? "Unnamed"}</div>
        {row.title && (
          <div className="truncate text-xs text-muted-foreground">
            {row.title}
          </div>
        )}
      </div>

      <div className="min-w-0 truncate text-xs text-muted-foreground">
        {row.team ?? "—"}
      </div>

      <div className="min-w-0">
        <Input
          value={row.email}
          onChange={(e) => {
            const next = e.target.value;
            const wasValid = isValidEmail(row.email);
            const nowValid = isValidEmail(next);
            // If the row had no email before and the user just typed a
            // valid one, default to selected.
            const selected =
              !wasValid && nowValid ? true : row.selected && nowValid;
            onChange(row.id, { email: next, selected });
          }}
          placeholder="name@company.com"
          className={cn(
            "h-8 text-xs",
            row.email && !emailValid && "border-destructive/60",
          )}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {confidencePct}%
        </span>
        <Progress value={confidencePct} className="h-1 w-12" />
      </div>
    </div>
  );
}

function ConnectKeyPanel({ onConnected }: { onConnected: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const connect = useConnectLlmKey({
    mutation: {
      onSuccess: () => {
        toast.success("Anthropic API key saved.");
        onConnected();
      },
      onError: (err) => {
        toast.error(`Couldn't save key: ${err.message}`);
      },
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        connect.mutate({ api_key: apiKey.trim() });
      }}
      className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="space-y-1 text-sm">
          <div className="font-medium">Anthropic API key not connected</div>
          <p className="text-muted-foreground">
            Bricktopus calls Claude to extract people from the file you
            uploaded. Paste a key to enable it — stored locally in your
            secrets file.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="anthropic-key">
          <KeyRound className="mr-1 inline h-3 w-3" />
          Anthropic API key
        </Label>
        <Input
          id="anthropic-key"
          type="password"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          required
          minLength={10}
        />
      </div>
      <DialogFooter>
        <Button
          type="submit"
          disabled={apiKey.trim().length < 10 || connect.isPending}
        >
          {connect.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-1.5 h-4 w-4" />
          )}
          Save key
        </Button>
      </DialogFooter>
    </form>
  );
}
