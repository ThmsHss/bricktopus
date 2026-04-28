import SidebarLayout from "@/components/apx/sidebar-layout";
import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  LineChart,
  Network,
  Sunrise,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_sidebar")({
  component: () => <Layout />,
});

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
}

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: "Account",
    items: [
      {
        to: "/overview",
        label: "Overview",
        icon: <LayoutDashboard size={16} />,
        match: (p) => p === "/overview" || p === "/",
      },
      {
        to: "/plan-my-day",
        label: "Plan my day",
        icon: <Sunrise size={16} />,
        match: (p) => p.startsWith("/plan-my-day"),
      },
      {
        to: "/ontology",
        label: "Ontology",
        icon: <Network size={16} />,
        match: (p) =>
          p.startsWith("/ontology") || p.startsWith("/account-org"),
      },
      {
        to: "/consumption",
        label: "Consumption",
        icon: <LineChart size={16} />,
        match: (p) => p.startsWith("/consumption"),
      },
    ],
  },
  {
    label: "Workflow",
    items: [
      {
        to: "/tasks",
        label: "Tasks",
        icon: <CheckSquare size={16} />,
        match: (p) => p.startsWith("/tasks"),
      },
      {
        to: "/meetings",
        label: "Meetings",
        icon: <CalendarDays size={16} />,
        match: (p) => p.startsWith("/meetings"),
      },
    ],
  },
];

function Layout() {
  const location = useLocation();

  return (
    <SidebarLayout>
      {sections.map((section) => (
        <SidebarGroup key={section.label}>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
            {section.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      item.match(location.pathname)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarLayout>
  );
}
