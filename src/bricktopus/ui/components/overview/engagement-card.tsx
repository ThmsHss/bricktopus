import { Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Engagement } from "@/data";
import { formatRelativeDays } from "@/lib/format";

interface EngagementCardProps {
  engagement: Engagement;
}

const engagementTone: Record<string, string> = {
  champion: "bg-success/15 text-success border-success/30",
  warm: "bg-primary/10 text-primary border-primary/30",
  cold: "bg-muted text-muted-foreground border-border",
  blocker: "bg-destructive/15 text-destructive border-destructive/30",
};

export function EngagementCard({ engagement }: EngagementCardProps) {
  const champions = engagement.contacts.filter(
    (c) => c.engagement === "champion",
  ).length;
  const cold = engagement.contacts.filter((c) => c.engagement === "cold").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <Users className="h-3.5 w-3.5 text-primary" />
          Engagement
        </div>
        <CardTitle className="font-serif text-2xl flex items-baseline gap-2">
          {engagement.coveredTeams.length}
          <span className="text-base font-normal text-muted-foreground">
            of {engagement.coveredTeams.length + engagement.gapTeams.length} teams
          </span>
        </CardTitle>
        <CardDescription>
          {champions} champion{champions === 1 ? "" : "s"} · {cold} cold contact
          {cold === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2.5">
          {engagement.contacts.slice(0, 4).map((contact) => (
            <li
              key={contact.name}
              className="flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {contact.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {contact.title}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatRelativeDays(contact.lastInteractionDays)}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase tracking-wider ${engagementTone[contact.engagement]}`}
                >
                  {contact.engagement}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
        {engagement.gapTeams.length > 0 && (
          <div className="rounded-md border border-dashed border-border/80 bg-muted/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Gap teams
            </div>
            <div className="flex flex-wrap gap-1.5">
              {engagement.gapTeams.map((team) => (
                <Badge
                  key={team}
                  variant="secondary"
                  className="text-[11px] font-normal"
                >
                  {team}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
