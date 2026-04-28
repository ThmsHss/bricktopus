import {
  CalendarClock,
  ExternalLink,
  Lightbulb,
  Mail,
  StickyNote,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDays } from "@/lib/format";
import type { MeetingBriefingItem } from "@/hooks/use-plan-my-day";

interface MeetingCardProps {
  item: MeetingBriefingItem;
}

const meetingTypeTone: Record<string, string> = {
  demo: "bg-primary/10 text-primary border-primary/30",
  discovery: "bg-warning/10 text-warning border-warning/30",
  "deep-dive": "bg-accent/40 text-accent-foreground border-accent",
  cadence: "bg-muted text-muted-foreground border-border",
  prep: "bg-success/10 text-success border-success/30",
  review: "bg-secondary text-secondary-foreground border-border",
  planning: "bg-secondary text-secondary-foreground border-border",
  meeting: "bg-muted text-muted-foreground border-border",
};

const classificationTone: Record<string, string> = {
  champion: "bg-success/15 text-success border-success/30",
  evaluator: "bg-warning/15 text-warning border-warning/30",
  blocking: "bg-destructive/15 text-destructive border-destructive/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

function formatTimeRange(startsIso: string, endsIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  return `${fmt(startsIso)} – ${fmt(endsIso)}`;
}

export function MeetingCard({ item }: MeetingCardProps) {
  const externalAttendees = item.attendees.filter((a) => !a.is_internal);
  const internalAttendees = item.attendees.filter((a) => a.is_internal);
  const typeTone =
    meetingTypeTone[item.meeting_type] ?? meetingTypeTone.meeting;

  return (
    <article className="group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Left rail: customer-facing accent */}
      <span
        className={`absolute inset-y-0 left-0 w-1 ${
          item.is_customer_facing
            ? "bg-primary"
            : item.is_internal
              ? "bg-muted-foreground/30"
              : "bg-border"
        }`}
        aria-hidden="true"
      />

      <div className="grid gap-6 p-5 pl-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:p-6 md:pl-7">
        {/* ---- Left: identity ---- */}
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            <time dateTime={item.starts_at}>
              {formatTimeRange(item.starts_at, item.ends_at)}
            </time>
            <span className="text-muted-foreground/60">·</span>
            <span className="tabular-nums">{item.duration_minutes}m</span>
          </div>

          <h2 className="font-serif text-xl leading-snug tracking-tight">
            {item.title}
          </h2>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={`text-[10px] uppercase tracking-wider ${typeTone}`}
            >
              {item.meeting_type}
            </Badge>
            {item.customer_name && (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider"
              >
                {item.customer_name}
              </Badge>
            )}
            {item.is_self_organized && (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                self-organized
              </Badge>
            )}
          </div>

          {externalAttendees.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Users className="h-3 w-3" />
                External
              </div>
              <ul className="flex flex-col gap-1.5">
                {externalAttendees.map((a) => (
                  <li
                    key={a.email}
                    className="flex flex-wrap items-center gap-1.5 text-sm"
                  >
                    <span className="font-medium">{a.email}</span>
                    {a.classification && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider ${
                          classificationTone[a.classification.toLowerCase()] ??
                          classificationTone.neutral
                        }`}
                      >
                        {a.classification}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {internalAttendees.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              + {internalAttendees.length} internal
            </p>
          )}

          <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-baseline gap-1.5">
              <dt className="uppercase tracking-wider text-[10px]">
                Last contact
              </dt>
              <dd className="font-medium text-foreground tabular-nums">
                {formatRelativeDays(item.last_contact_days_ago)}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="uppercase tracking-wider text-[10px]">
                Prior meetings
              </dt>
              <dd className="font-medium text-foreground tabular-nums">
                {item.prior_meeting_count}
              </dd>
            </div>
          </dl>
        </header>

        {/* ---- Right: signals + recommendation ---- */}
        <div className="flex flex-col gap-4">
          {item.notion_note && (
            <NotionBlock note={item.notion_note} />
          )}
          {item.latest_email && <EmailBlock email={item.latest_email} />}
          {!item.notion_note && !item.latest_email && (
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              No recent notes or threads cached for this customer yet.
            </div>
          )}

          <Recommendation text={item.recommendation} />

          {item.calendar_url && (
            <a
              href={item.calendar_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 self-start text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              Open in Calendar
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function NotionBlock({ note }: { note: NonNullable<MeetingBriefingItem["notion_note"]> }) {
  const edited = new Date(note.last_edited_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <figure className="rounded-lg border bg-background/60 p-4">
      <figcaption className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <StickyNote className="h-3 w-3" />
          Last meeting note
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          edited {edited}
        </span>
      </figcaption>
      <p className="text-sm font-medium leading-snug">{note.title}</p>
      {note.excerpt && (
        <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-xs leading-relaxed text-muted-foreground">
          {note.excerpt}
        </blockquote>
      )}
      {note.url && (
        <a
          href={note.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
        >
          Open note
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </figure>
  );
}

function EmailBlock({ email }: { email: NonNullable<MeetingBriefingItem["latest_email"]> }) {
  const last = new Date(email.last_message_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <figure className="rounded-lg border bg-background/60 p-4">
      <figcaption className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Mail className="h-3 w-3" />
          Latest thread
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {last} · {email.participant_count} participants
        </span>
      </figcaption>
      <p className="text-sm font-medium leading-snug">{email.subject}</p>
      {email.snippet && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {email.snippet}
        </p>
      )}
    </figure>
  );
}

function Recommendation({ text }: { text: string }) {
  return (
    <aside className="relative overflow-hidden rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Recommended angle
          </p>
          <p className="text-sm leading-snug text-foreground">{text}</p>
        </div>
      </div>
    </aside>
  );
}
