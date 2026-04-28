import { cn } from "@/lib/utils";
import type { OrgUnit } from "@/data";

export interface GroupBandData extends Record<string, unknown> {
  label: string;
}

export function GroupBand({ data }: { data: GroupBandData }) {
  return (
    <div className="pointer-events-none flex h-full w-full items-center">
      <div className="flex items-center gap-2 px-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          {data.label}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

const groupTone: Record<OrgUnit["group"], string> = {
  Executive: "border-foreground/30 bg-foreground/5 text-foreground",
  "Central IT": "border-chart-2/30 bg-chart-2/5 text-chart-2",
  "Business Unit": "border-primary/25 bg-primary/5 text-primary",
};

export interface ColumnHeaderData extends Record<string, unknown> {
  unit: OrgUnit;
  count: number;
}

export function ColumnHeader({ data }: { data: ColumnHeaderData }) {
  const { unit, count } = data;
  return (
    <div
      className={cn(
        "pointer-events-none flex h-full w-full flex-col justify-end rounded-t-md border-b-2 border-l border-r border-t bg-card/40 px-3 pb-2 pt-2",
        groupTone[unit.group],
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-sm font-semibold leading-tight">
          {unit.name}
        </span>
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {unit.description && (
        <span className="line-clamp-1 text-[10px] text-muted-foreground">
          {unit.description}
        </span>
      )}
    </div>
  );
}
