import { Cog, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Real-mode requires Calendar/Gmail/Notion adapters that aren't wired up
 * yet. The toggle stays visible so the future swap is obvious, but is
 * disabled and clearly marked "coming soon" — flipping it used to crash
 * the page with `RealNotImplementedError`.
 */
export function DataModeToggle() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm opacity-90"
            aria-disabled
          >
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Cog className="h-3.5 w-3.5" />
              Mock
            </span>
            <Switch checked={false} disabled aria-label="Toggle data source" />
            <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              Real
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px]">
          Real-data adapters (Calendar, Gmail, Notion, Salesforce) are not
          wired up yet. Currently always running on mock fixtures.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
