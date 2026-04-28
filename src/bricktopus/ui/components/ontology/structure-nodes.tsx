import { cn } from "@/lib/utils";
import type { OrgUnit } from "@/data";

export interface GroupBandData extends Record<string, unknown> {
  label: string;
  /** Visual tone driver — used by GroupPanel; GroupBand renders the same way. */
  tone?: "executive" | "central-it" | "business-units";
}

const bandToneClass: Record<NonNullable<GroupBandData["tone"]>, string> = {
  executive: "text-foreground/80",
  "central-it": "text-chart-2",
  "business-units": "text-primary",
};

const bandAccentClass: Record<NonNullable<GroupBandData["tone"]>, string> = {
  executive: "bg-foreground/30",
  "central-it": "bg-chart-2/40",
  "business-units": "bg-primary/40",
};

export function GroupBand({ data }: { data: GroupBandData }) {
  const tone = data.tone ?? "executive";
  return (
    <div className="pointer-events-none flex h-full w-full items-center">
      <div className="flex items-center gap-3 px-3">
        <span className={cn("h-[2px] w-10 rounded-full", bandAccentClass[tone])} />
        <span
          className={cn(
            "font-display text-sm font-semibold uppercase tracking-[0.24em]",
            bandToneClass[tone],
          )}
        >
          {data.label}
        </span>
        <span className={cn("h-[2px] flex-1 rounded-full", bandAccentClass[tone])} />
      </div>
    </div>
  );
}

export interface GroupPanelData extends Record<string, unknown> {
  tone: "central-it" | "business-units";
}

const panelToneClass: Record<GroupPanelData["tone"], string> = {
  "central-it": "border-chart-2/25 bg-chart-2/[0.04]",
  "business-units": "border-primary/25 bg-primary/[0.04]",
};

/**
 * A tinted background panel that visually anchors a group of columns.
 * Sits at zIndex -3 so people, edges, and headers render on top.
 */
export function GroupPanel({ data }: { data: GroupPanelData }) {
  return (
    <div
      className={cn(
        "pointer-events-none h-full w-full rounded-2xl border",
        panelToneClass[data.tone],
      )}
    />
  );
}

const groupAccent: Record<OrgUnit["group"], string> = {
  Executive: "before:bg-foreground/40",
  "Central IT": "before:bg-chart-2/50",
  "Business Unit": "before:bg-primary/50",
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
        // Restrained sub-header: short accent bar + small label + count.
        "pointer-events-none relative flex h-full w-full flex-col justify-end pb-2 pl-3 pr-2 pt-2",
        "before:absolute before:left-3 before:top-3 before:h-[2px] before:w-5 before:rounded-full",
        groupAccent[unit.group],
      )}
    >
      <div className="flex items-baseline justify-between gap-2 pt-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-foreground/80">
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
