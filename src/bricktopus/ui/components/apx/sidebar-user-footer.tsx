import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * Local identity placeholder. Once auth is wired (Databricks OAuth via
 * `@/lib/api`'s useCurrentUserSuspense), swap this for the real user.
 */
const localUser = {
  displayName: "Field Engineering",
  email: "you@databricks.com",
  initials: "FE",
};

export default function SidebarUserFooter() {
  return (
    <SidebarMenuButton size="lg">
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-medium">
          {localUser.initials}
        </AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{localUser.displayName}</span>
        <span className="text-muted-foreground truncate text-xs">
          {localUser.email}
        </span>
      </div>
    </SidebarMenuButton>
  );
}
