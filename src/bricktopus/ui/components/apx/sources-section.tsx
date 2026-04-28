import { useState } from "react";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  Plug,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSourcesStatus, type SourceStatus } from "@/hooks/use-sources";
import { ConnectModal } from "./connect-modal";

const ICON_BY_NAME: Record<string, LucideIcon> = {
  google_calendar: CalendarDays,
  gmail: Mail,
  notion: FileText,
  salesforce: Briefcase,
};

export function SourcesSection() {
  const { data: sources = [], isLoading } = useSourcesStatus();
  const [openSource, setOpenSource] = useState<SourceStatus | null>(null);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
          Sources
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {isLoading && (
              <SidebarMenuItem>
                <span className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </span>
              </SidebarMenuItem>
            )}
            {sources.map((s) => {
              const Icon = ICON_BY_NAME[s.name] ?? Plug;
              return (
                <SidebarMenuItem key={s.name}>
                  <button
                    type="button"
                    onClick={() => setOpenSource(s)}
                    className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{s.label}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <StatusDot authenticated={s.authenticated} />
                      {!s.authenticated && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
                          Connect
                        </span>
                      )}
                      {s.authenticated && (
                        <CheckCircle2 className="h-3 w-3 text-success" />
                      )}
                    </span>
                  </button>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <ConnectModal
        source={openSource}
        open={openSource !== null}
        onOpenChange={(open) => {
          if (!open) setOpenSource(null);
        }}
      />
    </>
  );
}

function StatusDot({ authenticated }: { authenticated: boolean }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 rounded-full",
        authenticated ? "bg-success" : "bg-muted-foreground/40",
      )}
      aria-hidden
    />
  );
}

