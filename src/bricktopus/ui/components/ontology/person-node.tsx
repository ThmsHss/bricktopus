import { Handle, Position } from "@xyflow/react";
import { Crown, ShieldAlert, Sparkles, Telescope, ThumbsUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { OrgPerson, PersonaType } from "@/data";
import { formatRelativeDays } from "@/lib/format";

const personaConfig: Record<
  PersonaType,
  { label: string; icon: LucideIcon; tone: string }
> = {
  champion: {
    label: "Champion",
    icon: Crown,
    tone: "bg-success/15 text-success border-success/30",
  },
  ally: {
    label: "Ally",
    icon: ThumbsUp,
    tone: "bg-primary/10 text-primary border-primary/30",
  },
  explorer: {
    label: "Explorer",
    icon: Telescope,
    tone: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  },
  skeptic: {
    label: "Skeptic",
    icon: Sparkles,
    tone: "bg-warning/15 text-warning border-warning/30",
  },
  blocker: {
    label: "Blocker",
    icon: ShieldAlert,
    tone: "bg-destructive/15 text-destructive border-destructive/30",
  },
  unknown: {
    label: "Unknown",
    icon: Sparkles,
    tone: "bg-muted text-muted-foreground border-border",
  },
};

interface RatingDotsProps {
  value: number;
  tone: "support" | "connection";
}

function RatingDots({ value, tone }: RatingDotsProps) {
  const total = 5;
  const filled = Math.max(0, Math.min(total, Math.round(value)));
  const dotColor = tone === "support" ? "bg-success" : "bg-primary";
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i < filled ? dotColor : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

export interface PersonNodeData extends Record<string, unknown> {
  person: OrgPerson;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function PersonNode({ data }: { data: PersonNodeData }) {
  const { person, selected, onSelect } = data;
  const config = personaConfig[person.persona.type];
  const Icon = config.icon;
  const isGap = person.isGapRole === true;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(person.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(person.id);
        }
      }}
      className={cn(
        "w-[240px] cursor-pointer rounded-lg border bg-card text-left shadow-sm transition-all",
        "hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isGap && "border-dashed bg-muted/40",
        selected && "border-primary shadow-md ring-1 ring-primary/40",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight">
              {person.name}
            </div>
            <div className="truncate text-[11px] leading-tight text-muted-foreground">
              {person.title}
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 gap-1 text-[10px] uppercase tracking-wider",
              config.tone,
            )}
          >
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-mono uppercase tracking-wider">
            {person.team}
          </span>
          <span>{formatRelativeDays(person.lastInteractionDays)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Support
            </span>
            <RatingDots value={person.supportRating} tone="support" />
          </div>
          <div className="flex flex-col gap-0.5 items-end">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Connection
            </span>
            <RatingDots value={person.connectionStrength} tone="connection" />
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
}
