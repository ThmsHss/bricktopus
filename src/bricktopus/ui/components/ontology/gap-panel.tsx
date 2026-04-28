import { CheckCircle2, AlertTriangle, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OntologyBundle, ValueChainFunction } from "@/data";

interface GapPanelProps {
  ontology: OntologyBundle;
}

interface CoverageInfo {
  status: "covered" | "partial" | "gap";
  label: string;
  tone: string;
  icon: typeof CheckCircle2;
}

function coverage(fn: ValueChainFunction, ontology: OntologyBundle): CoverageInfo {
  if (fn.coveredBy.length === 0) {
    return {
      status: "gap",
      label: "Gap",
      tone: "border-destructive/40 bg-destructive/10 text-destructive",
      icon: AlertTriangle,
    };
  }
  const champions = fn.coveredBy
    .map((id) => ontology.persons.find((p) => p.id === id))
    .filter(
      (p) => p && (p.persona.type === "champion" || p.persona.type === "ally"),
    );
  if (champions.length > 0) {
    return {
      status: "covered",
      label: "Covered",
      tone: "border-success/40 bg-success/10 text-success",
      icon: CheckCircle2,
    };
  }
  return {
    status: "partial",
    label: "At risk",
    tone: "border-warning/40 bg-warning/10 text-warning",
    icon: CircleDashed,
  };
}

export function GapPanel({ ontology }: GapPanelProps) {
  const sorted = [...ontology.valueChain].sort((a, b) => {
    const order = { core: 0, supporting: 1, emerging: 2 };
    return order[a.importance] - order[b.importance];
  });

  const counts = sorted.reduce(
    (acc, fn) => {
      const c = coverage(fn, ontology).status;
      acc[c] += 1;
      return acc;
    },
    { covered: 0, partial: 0, gap: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
              Value chain
            </div>
            <CardTitle className="font-display text-xl">
              Coverage map
            </CardTitle>
            <CardDescription>
              Retail & Apparel value chain — where we have champions, where we
              don't.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider">
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">
              {counts.covered} covered
            </span>
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">
              {counts.partial} at risk
            </span>
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
              {counts.gap} gap
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((fn) => {
          const cov = coverage(fn, ontology);
          const Icon = cov.icon;
          const coveredPersons = fn.coveredBy
            .map((id) => ontology.persons.find((p) => p.id === id))
            .filter((p): p is NonNullable<typeof p> => Boolean(p));
          return (
            <article
              key={fn.id}
              className={cn(
                "rounded-lg border bg-background/60 p-3 transition-colors",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                    cov.tone,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-tight">
                      {fn.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase tracking-wider"
                    >
                      {fn.importance}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {fn.description}
                  </p>
                  {coveredPersons.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {coveredPersons.map((p) => (
                        <Badge
                          key={p.id}
                          variant="secondary"
                          className="text-[10px] font-normal"
                        >
                          {p.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="pt-0.5 text-[11px] text-destructive">
                      Expected: {fn.expectedRoles.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
