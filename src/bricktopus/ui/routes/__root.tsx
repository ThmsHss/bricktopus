import { ThemeProvider } from "@/components/apx/theme-provider";
import { BricktopusProvider } from "@/data/context";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: () => (
    <ThemeProvider defaultTheme="light" storageKey="bricktopus-ui-theme">
      <BricktopusProvider>
        <Outlet />
        <Toaster richColors />
      </BricktopusProvider>
    </ThemeProvider>
  ),
});
