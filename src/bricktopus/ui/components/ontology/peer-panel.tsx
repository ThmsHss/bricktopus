import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PeerBenchmark, PeerSignal } from "@/data";

interface PeerPanelProps {
  peers: PeerBenchmark[];
}

const intensityTone: Record<PeerSignal["intensity"], string> = {
  high: "bg-primary/15 text-primary border-primary/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function PeerPanel({ peers }: PeerPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
          Peer benchmark
        </div>
        <CardTitle className="font-display text-xl">
          Where peers are leaning in
        </CardTitle>
        <CardDescription>
          Plays already running at industry peers — patterns to lift, gaps to
          close.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {peers.map((peer) => (
          <article
            key={peer.peer}
            className="rounded-lg border bg-background/60 p-3"
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold">{peer.peer}</span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider"
              >
                {peer.relationship.replace("-", " ")}
              </Badge>
            </div>
            <ul className="space-y-2 border-t pt-2">
              {peer.signals.map((s) => (
                <li
                  key={s.function}
                  className="space-y-1 rounded-md bg-card/40 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground/90">
                      {s.function}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] uppercase tracking-wider",
                        intensityTone[s.intensity],
                      )}
                    >
                      {s.intensity}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        At {peer.peer}
                      </div>
                      <div>{s.peerCoverage}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        At PUMA
                      </div>
                      <div>{s.ourCoverage}</div>
                    </div>
                  </div>
                  <p className="text-[11px] italic leading-snug text-primary/90">
                    {s.hint}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
