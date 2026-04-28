import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import SidebarUserFooter from "@/components/apx/sidebar-user-footer";
import { ModeToggle } from "@/components/apx/mode-toggle";
import { CustomerPicker } from "@/components/apx/customer-picker";
import { DataModeToggle } from "@/components/apx/data-mode-toggle";
import Logo from "@/components/apx/logo";
import { Separator } from "@/components/ui/separator";

interface SidebarLayoutProps {
  children?: ReactNode;
}

function SidebarLayout({ children }: SidebarLayoutProps) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex flex-col items-center gap-2 px-2 py-4">
            <Logo size="lg" showText={false} />
            <span className="font-display text-base tracking-tight">
              Bricktopus
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>{children}</SidebarContent>
        <SidebarFooter>
          <SidebarUserFooter />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="flex flex-col h-screen">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1 cursor-pointer" />
          <Separator orientation="vertical" className="!h-6" />
          <CustomerPicker />
          <div className="flex-1" />
          <DataModeToggle />
          <ModeToggle />
        </header>
        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1600px] px-6 py-8">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
export default SidebarLayout;
