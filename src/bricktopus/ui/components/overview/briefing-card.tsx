import { Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Briefing } from "@/data";

interface BriefingCardProps {
  briefing: Briefing;
}

export function BriefingCard({ briefing }: BriefingCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <CardHeader className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Today's briefing
        </div>
        <CardTitle className="font-serif text-2xl leading-snug">
          {briefing.headline}
        </CardTitle>
        <CardDescription className="text-base leading-relaxed text-foreground/80">
          {briefing.summary}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5 border-t pt-4">
          {briefing.highlights.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-snug">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
