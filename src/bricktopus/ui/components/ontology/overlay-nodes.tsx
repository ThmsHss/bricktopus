import { Handle, Position } from "@xyflow/react";
import { Database, FileText, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MeetingNoteSummary,
  OntologyUseCase,
  OntologyWorkspace,
  UseCaseStatus,
} from "@/data";

const useCaseTone: Record<UseCaseStatus, string> = {
  Live: "bg-success/10 text-success border-success/30",
  "In flight": "bg-primary/10 text-primary border-primary/30",
  Pilot: "bg-warning/10 text-warning border-warning/30",
  Aspirational: "bg-muted text-muted-foreground border-border",
};

interface OverlayShellProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  meta: string;
  tone?: string;
  selected?: boolean;
  onSelect?: () => void;
  width?: number;
  children?: React.ReactNode;
}

function OverlayShell({
  icon: Icon,
  eyebrow,
  title,
  meta,
  tone,
  selected,
  onSelect,
  width = 220,
  children,
}: OverlayShellProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      style={{ width }}
      className={cn(
        "cursor-pointer rounded-md border bg-card/80 px-2.5 py-2 text-left shadow-sm transition-all",
        "hover:border-primary/50 hover:bg-card hover:shadow",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary ring-1 ring-primary/40 bg-card",
        tone,
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <div className="flex items-start gap-2">
        <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-80" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-[9px] uppercase tracking-wider opacity-70">
            {eyebrow}
          </div>
          <div className="truncate text-xs font-semibold leading-tight">
            {title}
          </div>
          <div className="truncate text-[10px] opacity-70">{meta}</div>
        </div>
      </div>
      {children}
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
}

export interface UseCaseNodeData extends Record<string, unknown> {
  useCase: OntologyUseCase;
  workspaces: OntologyWorkspace[];
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function UseCaseNode({ data }: { data: UseCaseNodeData }) {
  const { useCase, workspaces, selected, onSelect } = data;
  return (
    <OverlayShell
      icon={Lightbulb}
      eyebrow={`Use case · ${useCase.status}`}
      title={useCase.name}
      meta={useCase.primarySku ?? useCase.valueChainFunction}
      tone={useCaseTone[useCase.status]}
      selected={selected}
      onSelect={() => onSelect?.(useCase.id)}
      width={240}
    >
      {workspaces.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-border/50 pt-1.5">
          <Database className="h-3 w-3 opacity-60" />
          {workspaces.map((w) => (
            <span
              key={w.id}
              className="rounded-sm border border-border/60 bg-background/70 px-1.5 py-0.5 text-[9px] font-mono leading-none text-muted-foreground"
            >
              {w.name}
            </span>
          ))}
        </div>
      )}
    </OverlayShell>
  );
}

export interface MeetingNodeData extends Record<string, unknown> {
  note: MeetingNoteSummary;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function MeetingNoteNode({ data }: { data: MeetingNodeData }) {
  const { note, selected, onSelect } = data;
  const date = new Date(note.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <OverlayShell
      icon={FileText}
      eyebrow="Meeting note"
      title={note.title}
      meta={date}
      selected={selected}
      onSelect={() => onSelect?.(note.id)}
      width={220}
    />
  );
}
