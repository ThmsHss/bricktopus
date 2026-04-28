import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Anomaly } from "@/data";
import { formatDate } from "@/lib/format";

interface AnomaliesCardProps {
  anomalies: Anomaly[];
}

const severityTone: Record<Anomaly["severity"], string> = {
  info: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function AnomaliesCard({ anomalies }: AnomaliesCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-primary" />
          Anomalies
        </div>
        <CardTitle className="font-serif text-2xl">
          {anomalies.length} signal{anomalies.length === 1 ? "" : "s"}
        </CardTitle>
        <CardDescription>Auto-detected from consumption + usage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {anomalies.map((anomaly) => (
          <article
            key={anomaly.id}
            className="rounded-lg border bg-background/60 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-snug">
                {anomaly.title}
              </h3>
              <Badge
                variant="outline"
                className={`shrink-0 text-[10px] uppercase tracking-wider ${severityTone[anomaly.severity]}`}
              >
                {anomaly.severity}
              </Badge>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {anomaly.description}
            </p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-mono">
                {anomaly.metric} · <span className="font-semibold">{anomaly.delta}</span>
              </span>
              <span>{formatDate(anomaly.detectedAt)}</span>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
