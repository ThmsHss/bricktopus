import type { OrgUnit } from "@/data";

export interface GroupBandData extends Record<string, unknown> {
  label: string;
  tone?: "executive" | "central-it" | "business-units";
}

export function GroupBand({ data }: { data: GroupBandData }) {
  return (
    <div className="pointer-events-none flex h-full w-full items-center">
      <div className="flex items-center gap-3 px-2">
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground/90">
          {data.label}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

export interface GroupPanelData extends Record<string, unknown> {
  tone: "central-it" | "business-units";
}

/**
 * Tinted background panel that visually anchors a group of columns.
 * Central IT and Business Units get distinct tints so the boundaries are
 * obvious at a glance without overwhelming the people cards.
 */
const panelToneClass: Record<GroupPanelData["tone"], string> = {
  "central-it": "border-chart-2/40 bg-chart-2/[0.06]",
  "business-units": "border-primary/35 bg-primary/[0.05]",
};

export function GroupPanel({ data }: { data: GroupPanelData }) {
  return (
    <div
      className={cn(
        "pointer-events-none h-full w-full rounded-2xl border-[1.5px] shadow-sm",
        panelToneClass[data.tone],
      )}
    />
  );
}

export interface ColumnHeaderData extends Record<string, unknown> {
  unit: OrgUnit;
  count: number;
}

export function ColumnHeader({ data }: { data: ColumnHeaderData }) {
  const { unit, count } = data;
  return (
    <div className="pointer-events-none flex h-full w-full flex-col justify-end px-3 pb-2 pt-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/85">
          {unit.name}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {unit.description && (
        <span className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/80">
          {unit.description}
        </span>
      )}
    </div>
  );
}
