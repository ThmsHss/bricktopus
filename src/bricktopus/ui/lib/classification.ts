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
    tone: "border-[oklch(0.62_0.15_145/0.4)] bg-[oklch(0.62_0.15_145/0.12)] text-[oklch(0.42_0.15_145)] dark:text-[oklch(0.78_0.15_145)]",
    solid: "bg-[oklch(0.62_0.15_145)] text-white border-[oklch(0.55_0.15_145)]",
  },
  supportive: {
    label: "Supportive",
    tone: "border-chart-2/40 bg-chart-2/12 text-chart-2",
    solid: "bg-chart-2 text-white border-chart-2",
  },
  blocking: {
    label: "Blocking",
    tone: "border-destructive/40 bg-destructive/10 text-destructive",
    solid: "bg-destructive text-white border-destructive",
  },
};
