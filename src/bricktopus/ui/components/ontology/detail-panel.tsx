import { useMemo } from "react";
import {
  Database,
  ExternalLink,
  FileText,
  Lightbulb,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  MeetingNoteSummary,
  OntologyBundle,
  OntologyUseCase,
  OntologyWorkspace,
  OrgPerson,
} from "@/data";
import { formatRelativeDays } from "@/lib/format";

interface DetailPanelProps {
  ontology: OntologyBundle;
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function DetailPanel({
  ontology,
  selectedId,
  onClose,
  onSelect,
}: DetailPanelProps) {
  const selection = useMemo(() => {
    if (!selectedId) return null;
    const person = ontology.persons.find((p) => p.id === selectedId);
    if (person) return { kind: "person" as const, person };
    const workspace = ontology.workspaces.find((w) => w.id === selectedId);
    if (workspace) return { kind: "workspace" as const, workspace };
    const useCase = ontology.useCases.find((u) => u.id === selectedId);
    if (useCase) return { kind: "useCase" as const, useCase };
    const note = ontology.meetingNotes.find((m) => m.id === selectedId);
    if (note) return { kind: "meetingNote" as const, note };
    return null;
  }, [ontology, selectedId]);

  if (!selection) return <EmptyDetail />;

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Detail
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onClose}
          aria-label="Close detail panel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto px-4 py-4">
        {selection.kind === "person" && (
          <PersonDetail
            ontology={ontology}
            person={selection.person}
            onSelect={onSelect}
          />
        )}
        {selection.kind === "workspace" && (
          <WorkspaceDetail
            ontology={ontology}
            workspace={selection.workspace}
            onSelect={onSelect}
          />
        )}
        {selection.kind === "useCase" && (
          <UseCaseDetail
            ontology={ontology}
            useCase={selection.useCase}
            onSelect={onSelect}
          />
        )}
        {selection.kind === "meetingNote" && (
          <MeetingNoteDetail
            ontology={ontology}
            note={selection.note}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-card p-6 text-center">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Detail
      </span>
      <p className="max-w-xs text-sm text-muted-foreground">
        Click a person, workspace, use case, or meeting note to see full
        context.
      </p>
    </div>
  );
}

interface SectionProps {
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}

function Section({ label, icon: Icon, children }: SectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      {children}
    </section>
  );
}

function RelatedLink({
  label,
  description,
  onClick,
  icon: Icon,
  tone,
}: {
  label: string;
  description?: string;
  onClick: () => void;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 rounded-md border bg-background/60 p-2 text-left transition-colors hover:border-primary/40 hover:bg-background",
        tone,
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{label}</div>
        {description && (
          <div className="truncate text-[10px] text-muted-foreground">
            {description}
          </div>
        )}
      </div>
    </button>
  );
}

function PersonDetail({
  ontology,
  person,
  onSelect,
}: {
  ontology: OntologyBundle;
  person: OrgPerson;
  onSelect: (id: string) => void;
}) {
  const linkedWorkspaces = ontology.workspaces.filter((w) =>
    person.workspaceIds?.includes(w.id) || w.primaryUserIds.includes(person.id),
  );
  const linkedUseCases = ontology.useCases.filter(
    (u) => u.sponsorIds.includes(person.id),
  );
  const linkedNotes = ontology.meetingNotes.filter((m) =>
    m.attendeeIds.includes(person.id),
  );

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-display text-2xl leading-tight">{person.name}</h2>
        <p className="text-xs text-muted-foreground">
          {person.title} · {person.team}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {person.persona.type}
          </Badge>
          <Badge variant="outline" className="text-[10px] tracking-wider">
            Last contact: {formatRelativeDays(person.lastInteractionDays)}
          </Badge>
          {person.isGapRole && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider border-dashed"
            >
              Gap role
            </Badge>
          )}
        </div>
      </header>
      <Separator />
      <Section label="Persona summary">
        <p className="text-sm leading-relaxed text-foreground/90">
          {person.persona.summary}
        </p>
        {person.persona.motivations.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {person.persona.motivations.map((m) => (
              <Badge
                key={m}
                variant="secondary"
                className="text-[10px] font-normal"
              >
                {m}
              </Badge>
            ))}
          </div>
        )}
      </Section>
      <div className="grid grid-cols-2 gap-3">
        <Section label="Support">
          <RatingBar value={person.supportRating} tone="success" />
        </Section>
        <Section label="Connection">
          <RatingBar value={person.connectionStrength} tone="primary" />
        </Section>
      </div>
      {person.notes && (
        <Section label="Notes">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {person.notes}
          </p>
        </Section>
      )}
      {person.linkedinUrl && (
        <a
          href={person.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          LinkedIn profile
        </a>
      )}
      {linkedWorkspaces.length > 0 && (
        <Section label="Workspaces" icon={Database}>
          <div className="space-y-1.5">
            {linkedWorkspaces.map((w) => (
              <RelatedLink
                key={w.id}
                icon={Database}
                label={w.name}
                description={`${w.environment} · ${w.region}`}
                onClick={() => onSelect(w.id)}
              />
            ))}
          </div>
        </Section>
      )}
      {linkedUseCases.length > 0 && (
        <Section label="Use cases" icon={Lightbulb}>
          <div className="space-y-1.5">
            {linkedUseCases.map((u) => (
              <RelatedLink
                key={u.id}
                icon={Lightbulb}
                label={u.name}
                description={`${u.status} · ${u.valueChainFunction}`}
                onClick={() => onSelect(u.id)}
              />
            ))}
          </div>
        </Section>
      )}
      {linkedNotes.length > 0 && (
        <Section label="Meeting notes" icon={FileText}>
          <div className="space-y-1.5">
            {linkedNotes.map((m) => (
              <RelatedLink
                key={m.id}
                icon={FileText}
                label={m.title}
                description={new Date(m.date).toLocaleDateString()}
                onClick={() => onSelect(m.id)}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function WorkspaceDetail({
  ontology,
  workspace,
  onSelect,
}: {
  ontology: OntologyBundle;
  workspace: OntologyWorkspace;
  onSelect: (id: string) => void;
}) {
  const users = ontology.persons.filter((p) =>
    workspace.primaryUserIds.includes(p.id),
  );
  const useCases = ontology.useCases.filter((u) =>
    u.sponsorIds.some((sid) => workspace.primaryUserIds.includes(sid)),
  );

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-display text-2xl leading-tight">{workspace.name}</h2>
        <p className="text-xs text-muted-foreground">
          Workspace · {workspace.environment} · {workspace.region}
        </p>
      </header>
      <Separator />
      {workspace.description && (
        <Section label="About">
          <p className="text-sm leading-relaxed text-foreground/90">
            {workspace.description}
          </p>
        </Section>
      )}
      {users.length > 0 && (
        <Section label="Primary users">
          <div className="space-y-1.5">
            {users.map((u) => (
              <RelatedLink
                key={u.id}
                icon={Lightbulb}
                label={u.name}
                description={u.title}
                onClick={() => onSelect(u.id)}
              />
            ))}
          </div>
        </Section>
      )}
      {useCases.length > 0 && (
        <Section label="Linked use cases">
          <div className="space-y-1.5">
            {useCases.map((u) => (
              <RelatedLink
                key={u.id}
                icon={Lightbulb}
                label={u.name}
                description={u.status}
                onClick={() => onSelect(u.id)}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function UseCaseDetail({
  ontology,
  useCase,
  onSelect,
}: {
  ontology: OntologyBundle;
  useCase: OntologyUseCase;
  onSelect: (id: string) => void;
}) {
  const sponsors = ontology.persons.filter((p) =>
    useCase.sponsorIds.includes(p.id),
  );

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-display text-2xl leading-tight">{useCase.name}</h2>
        <p className="text-xs text-muted-foreground">
          {useCase.status} · {useCase.valueChainFunction}
          {useCase.primarySku ? ` · ${useCase.primarySku}` : ""}
        </p>
      </header>
      <Separator />
      {useCase.description && (
        <Section label="About">
          <p className="text-sm leading-relaxed text-foreground/90">
            {useCase.description}
          </p>
        </Section>
      )}
      <Section label="Sponsors">
        {sponsors.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No sponsor identified yet — this is a gap.
          </p>
        ) : (
          <div className="space-y-1.5">
            {sponsors.map((s) => (
              <RelatedLink
                key={s.id}
                icon={Lightbulb}
                label={s.name}
                description={`${s.title} · ${s.team}`}
                onClick={() => onSelect(s.id)}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function MeetingNoteDetail({
  ontology,
  note,
  onSelect,
}: {
  ontology: OntologyBundle;
  note: MeetingNoteSummary;
  onSelect: (id: string) => void;
}) {
  const attendees = ontology.persons.filter((p) =>
    note.attendeeIds.includes(p.id),
  );

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-display text-2xl leading-tight">{note.title}</h2>
        <p className="text-xs text-muted-foreground">
          {new Date(note.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>
      <Separator />
      <Section label="Summary">
        <p className="text-sm leading-relaxed text-foreground/90">
          {note.summary}
        </p>
      </Section>
      {note.lessons.length > 0 && (
        <Section label="Lessons">
          <ul className="space-y-1.5">
            {note.lessons.map((l) => (
              <li
                key={l}
                className="flex items-start gap-2 text-sm leading-snug"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {l}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {attendees.length > 0 && (
        <Section label="Attendees">
          <div className="space-y-1.5">
            {attendees.map((a) => (
              <RelatedLink
                key={a.id}
                icon={Lightbulb}
                label={a.name}
                description={a.title}
                onClick={() => onSelect(a.id)}
              />
            ))}
          </div>
        </Section>
      )}
      {note.externalUrl && (
        <a
          href={note.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Open original
        </a>
      )}
    </div>
  );
}

function RatingBar({
  value,
  tone,
}: {
  value: number;
  tone: "success" | "primary";
}) {
  const pct = (value / 5) * 100;
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "success" ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {value.toFixed(1)} / 5
      </span>
    </div>
  );
}
