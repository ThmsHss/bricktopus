import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  MEETING_TYPES,
  useCalendarEvents,
  useCustomerOptions,
  useUpdateEventClassification,
  type CalendarEventRow,
  type MeetingType,
} from "@/hooks/use-calendar-events";

interface ReclassifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null; // "other" or a real id; null means closed
  customerName: string;
  start: string; // YYYY-MM-DD
  end: string;
}

export function ReclassifyDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  start,
  end,
}: ReclassifyDialogProps) {
  const events = useCalendarEvents({
    customer_id: customerId ?? undefined,
    start,
    end,
    limit: 50,
  });
  const customers = useCustomerOptions();
  const update = useUpdateEventClassification();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[640px] flex flex-col p-0"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-display text-lg">
            Reclassify · {customerName}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {start} → {end} · changes here are saved as manual overrides.
          </p>
        </SheetHeader>
        <div className="flex-1 overflow-auto px-5 py-4">
          {events.isPending ? (
            <Skeletons />
          ) : events.error ? (
            <p className="text-sm text-destructive">
              {events.error instanceof Error
                ? events.error.message
                : String(events.error)}
            </p>
          ) : events.data && events.data.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events in this range. Try widening the window.
            </p>
          ) : (
            <ul className="space-y-2">
              {events.data?.events.map((evt) => (
                <EventRow
                  key={evt.id}
                  event={evt}
                  customerOptions={customers.data?.customers ?? []}
                  onSave={async (cid, mt) => {
                    try {
                      await update.mutateAsync({
                        event_id: evt.id,
                        customer_id: cid,
                        meeting_type: mt,
                      });
                      toast.success("Saved", {
                        description: `${evt.summary.slice(0, 50)}…`,
                      });
                    } catch (err) {
                      toast.error("Save failed", {
                        description:
                          err instanceof Error ? err.message : String(err),
                      });
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface EventRowProps {
  event: CalendarEventRow;
  customerOptions: { customer_id: string; customer_name: string }[];
  onSave: (
    customer_id: string | null,
    meeting_type: MeetingType | null,
  ) => Promise<void>;
}

function EventRow({ event, customerOptions, onSave }: EventRowProps) {
  const [cid, setCid] = useState<string>(event.customer_id ?? "__null__");
  const [mt, setMt] = useState<string>(event.meeting_type ?? "other");
  const [saving, setSaving] = useState(false);
  const dirty =
    cid !== (event.customer_id ?? "__null__") ||
    mt !== (event.meeting_type ?? "other");

  const start = new Date(event.starts_at);
  const dateLabel = start.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <li className="rounded-lg border bg-background/60 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{event.summary}</div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{dateLabel}</span>
            <span>·</span>
            <span>{event.duration_minutes}m</span>
            {event.classification_source === "manual" && (
              <Badge
                variant="outline"
                className="h-4 px-1.5 text-[9px] uppercase tracking-wider border-success/40 text-success"
              >
                manual
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={cid} onValueChange={setCid}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__null__">— Unattributed —</SelectItem>
            {customerOptions.map((opt) => (
              <SelectItem key={opt.customer_id} value={opt.customer_id}>
                {opt.customer_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mt} onValueChange={setMt}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {MEETING_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {dirty && (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              setCid(event.customer_id ?? "__null__");
              setMt(event.meeting_type ?? "other");
            }}
            disabled={saving}
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(
                  cid === "__null__" ? null : cid,
                  mt as MeetingType,
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
        </div>
      )}
    </li>
  );
}

function Skeletons() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className="rounded-lg border bg-background/60 p-3 space-y-2"
        >
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </li>
      ))}
    </ul>
  );
}
