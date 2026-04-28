import { Handle, Position } from "@xyflow/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { OrgPerson } from "@/data";
import {
  CLASSIFICATION_META,
  resolveClassification,
  type Classification,
} from "@/lib/classification";

export interface PersonNodeData extends Record<string, unknown> {
  person: OrgPerson;
  classification?: Classification | null;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function PersonNode({ data }: { data: PersonNodeData }) {
  const { person, classification, selected, onSelect } = data;
  const effective = resolveClassification(person.persona.type, classification);
  const meta = effective ? CLASSIFICATION_META[effective] : null;
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
        "group w-[232px] cursor-pointer rounded-lg border bg-card text-left shadow-sm transition-all",
        "hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isGap && "border-dashed bg-muted/40",
        selected && "border-primary shadow-md ring-1 ring-primary/40",
      )}
    >
      <Handle id="tgt" type="target" position={Position.Top} className="!bg-border" />
      <div className="flex flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">
            {person.name}
          </div>
          <div className="truncate text-[11px] leading-tight text-muted-foreground">
            {person.title}
          </div>
        </div>
        <div className="flex items-center">
          {meta ? (
            <Badge
              variant="outline"
              className={cn(
                "h-5 px-2 text-[10px] uppercase tracking-[0.14em]",
                meta.tone,
              )}
            >
              {meta.label}
            </Badge>
          ) : (
            <span
              className={cn(
                "inline-flex h-5 items-center gap-1 rounded-md border border-dashed border-border/80",
                "bg-background/60 px-2 text-[10px] uppercase tracking-[0.14em]",
                "text-muted-foreground/80 group-hover:border-primary/40 group-hover:text-foreground",
              )}
            >
              <Plus className="h-2.5 w-2.5" />
              Classify
            </span>
          )}
        </div>
      </div>
      <Handle id="src" type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
}
