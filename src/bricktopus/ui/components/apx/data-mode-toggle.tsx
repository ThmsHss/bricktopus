import { Cog, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBricktopus } from "@/data/context";

export function DataModeToggle() {
  const { mode, setMode } = useBricktopus();
  const isReal = mode === "real";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                !isReal ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <Cog className="h-3.5 w-3.5" />
              Mock
            </span>
            <Switch
              checked={isReal}
              onCheckedChange={(checked) => setMode(checked ? "real" : "mock")}
              aria-label="Toggle data source"
            />
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                isReal ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Real
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px]">
          {isReal
            ? "Real adapters (Salesforce, Logfood, Slack, Glean) are not wired yet — most queries will error."
            : "Using mock fixtures. Toggle to real once adapters are wired."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
