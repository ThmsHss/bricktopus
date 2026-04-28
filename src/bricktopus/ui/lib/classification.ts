import type { PersonaType } from "@/data";

/**
 * The simplified classification an SA assigns to a person. The DB stores one
 * of the three concrete values; `null` represents "no classification yet" and
 * surfaces the "Classify" affordance in the UI.
 */
export type Classification = "champion" | "supportive" | "blocking";

export const CLASSIFICATIONS: readonly Classification[] = [
  "champion",
  "supportive",
  "blocking",
] as const;

const PERSONA_TO_CLASSIFICATION: Record<PersonaType, Classification | null> = {
  champion: "champion",
  ally: "supportive",
  explorer: "supportive",
  skeptic: "blocking",
  blocker: "blocking",
  unknown: null,
};

/**
 * Resolve the effective classification for a person.
 *
 * The user's manual classification (from the DB) wins; otherwise we fall back
 * to the persona-derived seed baked into the fixture. Fixture-only people with
 * `unknown` persona end up unclassified so the UI can prompt for input.
 */
export function resolveClassification(
  personaType: PersonaType,
  manual: Classification | null | undefined,
): Classification | null {
  if (manual) return manual;
  return PERSONA_TO_CLASSIFICATION[personaType];
}

interface ClassificationMeta {
  label: string;
  /** Tailwind classes for the badge (border + bg + text). */
  tone: string;
  /** Tailwind classes for solid fills (e.g. radio active state). */
  solid: string;
}

export const CLASSIFICATION_META: Record<Classification, ClassificationMeta> = {
  champion: {
    label: "Champion",
    tone: "border-success/35 bg-success/10 text-success",
    solid: "bg-success text-success-foreground border-success",
  },
  supportive: {
    label: "Supportive",
    tone: "border-primary/35 bg-primary/10 text-primary",
    solid: "bg-primary text-primary-foreground border-primary",
  },
  blocking: {
    label: "Blocking",
    tone: "border-destructive/40 bg-destructive/10 text-destructive",
    solid: "bg-destructive text-destructive-foreground border-destructive",
  },
};
