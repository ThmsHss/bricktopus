import { ChevronRight, Compass } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NextBestAction } from "@/data";

interface NbaCardProps {
  actions: NextBestAction[];
}

const confidenceTone: Record<NextBestAction["confidence"], string> = {
  high: "bg-success/15 text-success border-success/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

const categoryLabel: Record<NextBestAction["category"], string> = {
  land: "Land",
  adopt: "Adopt",
  expand: "Expand",
  renew: "Renew",
};

export function NbaCard({ actions }: NbaCardProps) {
  return (
    <Card className="bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <Compass className="h-3.5 w-3.5 text-primary" />
          Bricktopus suggests
        </div>
        <CardTitle className="font-serif text-2xl">Next best moves</CardTitle>
        <CardDescription>
          Ranked by likely impact on this account this week.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <article
            key={action.id}
            className="group rounded-lg border bg-background/60 p-4 transition-colors hover:border-primary/40 hover:bg-background"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-sm text-primary">
                {index + 1}
              </span>
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wider"
                  >
                    {categoryLabel[action.category]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase tracking-wider ${confidenceTone[action.confidence]}`}
                  >
                    {action.confidence} confidence
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold leading-snug">
                  {action.headline}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {action.rationale}
                </p>
                <p className="text-xs font-medium text-primary">
                  {action.estimatedImpact}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
