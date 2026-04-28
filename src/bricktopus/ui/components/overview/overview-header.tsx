import { Badge } from "@/components/ui/badge";
import type { Customer } from "@/data";

interface OverviewHeaderProps {
  customer: Customer;
  generatedAt: string;
}

const stageTone: Record<Customer["lifecycleStage"], string> = {
  Land: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  Adopt: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  Expand: "bg-primary/15 text-primary border-primary/30",
  Renew: "bg-chart-5/15 text-chart-5 border-chart-5/30",
};

export function OverviewHeader({ customer, generatedAt }: OverviewHeaderProps) {
  const generated = new Date(generatedAt);
  const generatedLabel = generated.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header className="flex flex-col gap-3 pb-2">
      <div className="flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Account control center
        </span>
        <Badge
          variant="outline"
          className={`${stageTone[customer.lifecycleStage]} font-medium`}
        >
          {customer.lifecycleStage}
        </Badge>
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-5xl tracking-tight leading-none">
          {customer.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {customer.industry} · {customer.region} · HQ {customer.hq}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Briefing generated {generatedLabel}
      </p>
    </header>
  );
}
