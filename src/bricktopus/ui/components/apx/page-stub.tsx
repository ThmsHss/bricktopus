import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

interface PageStubProps {
  title: string;
  blurb: string;
  icon?: LucideIcon;
}

export function PageStub({ title, blurb, icon: Icon = Sparkles }: PageStubProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        Coming next
      </div>
      <h1 className="font-serif text-4xl tracking-tight">{title}</h1>
      <p className="max-w-prose text-base text-muted-foreground">{blurb}</p>
      <div className="mt-6 rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
        Mock data and components for this surface ship in a follow-up commit.
      </div>
    </div>
  );
}
