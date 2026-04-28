import {
  CheckSquare,
  Mail,
  MessageSquare,
  CalendarDays,
  Briefcase,
  Hand,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OpenTask } from "@/data";
import { formatDate } from "@/lib/format";

interface TasksCardProps {
  tasks: OpenTask[];
}

const sourceIcon: Record<OpenTask["source"], LucideIcon> = {
  email: Mail,
  slack: MessageSquare,
  meeting: CalendarDays,
  salesforce: Briefcase,
  manual: Hand,
};

const priorityTone: Record<OpenTask["priority"], string> = {
  p0: "bg-destructive/15 text-destructive border-destructive/30",
  p1: "bg-warning/15 text-warning border-warning/30",
  p2: "bg-muted text-muted-foreground border-border",
};

const statusTone: Record<OpenTask["status"], string> = {
  open: "bg-muted text-muted-foreground",
  in_progress: "bg-chart-2/15 text-chart-2",
  blocked: "bg-destructive/15 text-destructive",
};

export function TasksCard({ tasks }: TasksCardProps) {
  const sorted = [...tasks].sort((a, b) => {
    const order = { p0: 0, p1: 1, p2: 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <CheckSquare className="h-3.5 w-3.5 text-primary" />
          Open tasks
        </div>
        <CardTitle className="font-serif text-2xl">
          {tasks.length} active
        </CardTitle>
        <CardDescription>From email, Slack, meetings + Salesforce</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {sorted.slice(0, 4).map((task) => {
          const Icon = sourceIcon[task.source];
          return (
            <article
              key={task.id}
              className="rounded-lg border bg-background/60 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium leading-snug">
                    {task.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{task.owner}</span>
                    <span>·</span>
                    <span>due {formatDate(task.dueDate)}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wider ${priorityTone[task.priority]}`}
                    >
                      {task.priority}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wider border-transparent ${statusTone[task.status]}`}
                    >
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
