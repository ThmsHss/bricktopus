import { FileText, Lightbulb, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OntologyLayers } from "./ontology-canvas";

interface LayerTogglesProps {
  layers: OntologyLayers;
  onChange: (next: OntologyLayers) => void;
}

interface ToggleSpec {
  key: keyof OntologyLayers | "people";
  label: string;
  icon: LucideIcon;
  tone: string;
  alwaysOn?: boolean;
}

const toggles: ToggleSpec[] = [
  {
    key: "people",
    label: "People",
    icon: Users,
    tone: "border-foreground/30 bg-foreground/5 text-foreground",
    alwaysOn: true,
  },
  {
    key: "useCases",
    label: "Use cases · workspaces",
    icon: Lightbulb,
    tone: "border-chart-3/40 bg-chart-3/10 text-chart-3",
  },
  {
    key: "meetingNotes",
    label: "Meeting notes",
    icon: FileText,
    tone: "border-chart-4/40 bg-chart-4/10 text-chart-4",
  },
];

export function LayerToggles({ layers, onChange }: LayerTogglesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Layers
      </span>
      {toggles.map((t) => {
        const isOn =
          t.alwaysOn ?? layers[t.key as keyof OntologyLayers] === true;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            disabled={t.alwaysOn}
            onClick={() => {
              if (t.alwaysOn) return;
              onChange({
                ...layers,
                [t.key]: !layers[t.key as keyof OntologyLayers],
              });
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isOn
                ? t.tone
                : "border-border bg-card text-muted-foreground hover:bg-accent/40",
              t.alwaysOn && "cursor-default opacity-90",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
