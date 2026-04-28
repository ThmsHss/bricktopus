import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBricktopus } from "@/data/context";
import { useCustomers } from "@/hooks/use-overview";
import type { CustomerId } from "@/data";

export function CustomerPicker() {
  const { customerId, setCustomerId } = useBricktopus();
  const { data: customers } = useCustomers();
  const current = customers?.find((c) => c.id === customerId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent/40 transition-colors">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Account
          </span>
          <span className="font-serif text-base leading-none">
            {current?.name ?? "Select customer"}
          </span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[260px]">
        <DropdownMenuLabel>Switch account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {customers?.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onSelect={() => setCustomerId(c.id as CustomerId)}
            className="flex items-start gap-2"
          >
            <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {c.industry} · {c.region}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
