import type { Edge, Node } from "@xyflow/react";
import type { OntologyBundle, OrgPerson, OrgUnit } from "@/data";

/* ────────── Person card geometry ────────── */
export const PERSON_NODE_WIDTH = 232;
export const PERSON_NODE_HEIGHT = 92;
export const USECASE_NODE_WIDTH = 240;
export const USECASE_NODE_HEIGHT = 96;
export const MEETING_NODE_WIDTH = 220;
export const MEETING_NODE_HEIGHT = 70;

/* ────────── Layout constants ────────── */
const COLUMN_GAP = 24;
const SECTION_GAP = 80; // gap between Central IT and Business Unit blocks
const ROW_GAP = 18;
const EXEC_BAND_Y = 0;
const EXEC_BAND_HEIGHT = 180;
const COLUMN_HEADER_HEIGHT = 48;
const STAGE_TOP_PADDING = 16;
const STAGE_OUTER_PADDING = 32;
const GROUP_BANNER_OFFSET = 36; // distance above section top where banner sits
const GROUP_BANNER_HEIGHT = 26;
const PANEL_PAD_X = 18; // horizontal padding inside the tinted group panel
const PANEL_PAD_TOP = 18;
const PANEL_PAD_BOTTOM = 24;

interface SwimlaneColumn {
  unit: OrgUnit;
  persons: OrgPerson[];
}

export interface SwimlaneLayout {
  nodes: Node[];
  edges: Edge[];
  width: number;
  height: number;
}

interface PositionedPerson {
  id: string;
  x: number;
  y: number;
}

/**
 * Bucket persons into columns by org unit, ordered by reportsTo depth so
 * managers sit above their reports inside each column.
 */
function bucketByUnit(
  ontology: OntologyBundle,
): { exec: OrgPerson[]; centralIt: SwimlaneColumn[]; bus: SwimlaneColumn[] } {
  const byUnit = new Map<string, OrgPerson[]>();
  ontology.persons.forEach((p) => {
    const arr = byUnit.get(p.orgUnitId) ?? [];
    arr.push(p);
    byUnit.set(p.orgUnitId, arr);
  });

  const depthOf = (p: OrgPerson, persons: OrgPerson[]): number => {
    let depth = 0;
    let current: OrgPerson | undefined = p;
    while (current?.reportsTo) {
      const next: OrgPerson | undefined = persons.find(
        (x) => x.id === current!.reportsTo,
      );
      if (!next) break;
      depth += 1;
      current = next;
    }
    return depth;
  };

  const sortColumn = (arr: OrgPerson[]) =>
    [...arr].sort(
      (a, b) =>
        depthOf(a, ontology.persons) - depthOf(b, ontology.persons) ||
        a.name.localeCompare(b.name),
    );

  const exec = sortColumn(
    ontology.orgUnits
      .filter((u) => u.group === "Executive")
      .flatMap((u) => byUnit.get(u.id) ?? []),
  );

  const centralIt = ontology.orgUnits
    .filter((u) => u.group === "Central IT")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((unit) => ({ unit, persons: sortColumn(byUnit.get(unit.id) ?? []) }));

  const bus = ontology.orgUnits
    .filter((u) => u.group === "Business Unit")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((unit) => ({ unit, persons: sortColumn(byUnit.get(unit.id) ?? []) }));

  return { exec, centralIt, bus };
}

interface SectionBlockProps {
  startX: number;
  columns: SwimlaneColumn[];
  groupLabel: string;
  groupId: string;
  groupTone: "central-it" | "business-units";
  positionedPersons: PositionedPerson[];
  panelNodes: Node[];
  bannerNodes: Node[];
  columnNodes: Node[];
}

interface SectionBlockResult {
  width: number;
  bottom: number;
}

function placeSectionColumns({
  startX,
  columns,
  groupLabel,
  groupId,
  groupTone,
  positionedPersons,
  panelNodes,
  bannerNodes,
  columnNodes,
}: SectionBlockProps): SectionBlockResult {
  const columnWidth = PERSON_NODE_WIDTH;
  const sectionWidth =
    columns.length === 0
      ? 0
      : columns.length * columnWidth + (columns.length - 1) * COLUMN_GAP;

  if (sectionWidth === 0) return { width: 0, bottom: EXEC_BAND_HEIGHT };

  const sectionTop = EXEC_BAND_HEIGHT;
  const tallest = columns.reduce(
    (acc, c) => Math.max(acc, c.persons.length),
    0,
  );
  const personsHeight =
    tallest > 0
      ? tallest * PERSON_NODE_HEIGHT + (tallest - 1) * ROW_GAP
      : 0;
  const sectionInnerHeight =
    COLUMN_HEADER_HEIGHT + STAGE_TOP_PADDING + personsHeight;

  // Tinted background panel that anchors the entire section.
  panelNodes.push({
    id: `panel-${groupId}`,
    type: "groupPanel",
    position: {
      x: startX - PANEL_PAD_X,
      y: sectionTop - PANEL_PAD_TOP,
    },
    data: { tone: groupTone },
    width: sectionWidth + PANEL_PAD_X * 2,
    height: sectionInnerHeight + PANEL_PAD_TOP + PANEL_PAD_BOTTOM,
    selectable: false,
    draggable: false,
    focusable: false,
    zIndex: -3,
  });

  // Confident banner sitting above the section.
  bannerNodes.push({
    id: `band-${groupId}`,
    type: "groupBand",
    position: {
      x: startX - PANEL_PAD_X,
      y: sectionTop - PANEL_PAD_TOP - GROUP_BANNER_OFFSET,
    },
    data: { label: groupLabel, tone: groupTone },
    width: sectionWidth + PANEL_PAD_X * 2,
    height: GROUP_BANNER_HEIGHT,
    selectable: false,
    draggable: false,
    focusable: false,
    zIndex: -1,
  });

  columns.forEach((col, ci) => {
    const x = startX + ci * (columnWidth + COLUMN_GAP);
    const colTop = sectionTop;
    columnNodes.push({
      id: `col-${col.unit.id}`,
      type: "columnHeader",
      position: { x, y: colTop },
      data: { unit: col.unit, count: col.persons.length },
      width: columnWidth,
      height: COLUMN_HEADER_HEIGHT,
      selectable: false,
      draggable: false,
      focusable: false,
      zIndex: 0,
    });
    col.persons.forEach((p, pi) => {
      const y =
        colTop +
        COLUMN_HEADER_HEIGHT +
        STAGE_TOP_PADDING +
        pi * (PERSON_NODE_HEIGHT + ROW_GAP);
      positionedPersons.push({ id: p.id, x, y });
    });
  });

  return {
    width: sectionWidth,
    bottom: sectionTop + sectionInnerHeight + PANEL_PAD_BOTTOM,
  };
}

export function buildSwimlaneLayout(
  ontology: OntologyBundle,
): SwimlaneLayout {
  const { exec, centralIt, bus } = bucketByUnit(ontology);

  const panelNodes: Node[] = [];
  const bannerNodes: Node[] = [];
  const columnNodes: Node[] = [];
  const positionedPersons: PositionedPerson[] = [];

  // Central IT block (left)
  const centralItRes = placeSectionColumns({
    startX: STAGE_OUTER_PADDING,
    columns: centralIt,
    groupLabel: "Central IT",
    groupId: "central-it",
    groupTone: "central-it",
    positionedPersons,
    panelNodes,
    bannerNodes,
    columnNodes,
  });

  const busStartX =
    STAGE_OUTER_PADDING +
    centralItRes.width +
    (centralItRes.width > 0 ? SECTION_GAP : 0);

  // Business Units block (right)
  const busRes = placeSectionColumns({
    startX: busStartX,
    columns: bus,
    groupLabel: "Business Units",
    groupId: "business-units",
    groupTone: "business-units",
    positionedPersons,
    panelNodes,
    bannerNodes,
    columnNodes,
  });

  // Vertical separator nestled between the two sections.
  if (centralItRes.width > 0 && busRes.width > 0) {
    const separatorTop = EXEC_BAND_HEIGHT - PANEL_PAD_TOP - GROUP_BANNER_OFFSET;
    const separatorBottom = Math.max(centralItRes.bottom, busRes.bottom);
    const separatorX =
      STAGE_OUTER_PADDING + centralItRes.width + SECTION_GAP / 2;
    panelNodes.push({
      id: "section-divider",
      type: "groupPanel",
      position: { x: separatorX - 1, y: separatorTop },
      data: { tone: "central-it" },
      width: 2,
      height: separatorBottom - separatorTop,
      selectable: false,
      draggable: false,
      focusable: false,
      zIndex: -2,
      // Hide the rounded border via inline style so this reads as a hairline.
      style: {
        background: "var(--border)",
        opacity: 0.6,
        border: "none",
        borderRadius: 0,
      },
    });
  }

  const stageWidth =
    centralItRes.width +
    (centralItRes.width > 0 && busRes.width > 0 ? SECTION_GAP : 0) +
    busRes.width +
    STAGE_OUTER_PADDING * 2;

  // Executive band — centered across the full stage
  if (exec.length > 0) {
    const execTotalWidth =
      exec.length * PERSON_NODE_WIDTH + (exec.length - 1) * COLUMN_GAP;
    const execStartX = (stageWidth - execTotalWidth) / 2;

    bannerNodes.push({
      id: "band-exec",
      type: "groupBand",
      position: { x: STAGE_OUTER_PADDING / 2, y: EXEC_BAND_Y },
      data: { label: "Executive", tone: "executive" },
      width: stageWidth - STAGE_OUTER_PADDING,
      height: GROUP_BANNER_HEIGHT,
      selectable: false,
      draggable: false,
      focusable: false,
      zIndex: -1,
    });

    exec.forEach((p, i) => {
      const x = execStartX + i * (PERSON_NODE_WIDTH + COLUMN_GAP);
      positionedPersons.push({
        id: p.id,
        x,
        y: EXEC_BAND_Y + 36,
      });
    });
  }

  // Build person nodes from positions
  const personIndex = new Map(ontology.persons.map((p) => [p.id, p]));
  const personNodes: Node[] = positionedPersons.map((pp) => ({
    id: pp.id,
    type: "person",
    position: { x: pp.x, y: pp.y },
    data: { person: personIndex.get(pp.id)! },
    width: PERSON_NODE_WIDTH,
    height: PERSON_NODE_HEIGHT,
  }));

  // ReportsTo edges (subtle, stay in person layer)
  const personEdges: Edge[] = ontology.persons
    .filter((p) => p.reportsTo !== null)
    .map((p) => ({
      id: `e-rep-${p.reportsTo}-${p.id}`,
      source: p.reportsTo!,
      target: p.id,
      type: "smoothstep",
      style: { stroke: "var(--border)", strokeWidth: 1 },
      sourceHandle: "src",
      targetHandle: "tgt",
    }));

  // Order matters for default render z-order: panels first (deepest), then
  // banners, then column headers, then people. Explicit `zIndex` on each node
  // also enforces stacking.
  const allNodes = [
    ...panelNodes,
    ...bannerNodes,
    ...columnNodes,
    ...personNodes,
  ];
  const stageHeight = Math.max(centralItRes.bottom, busRes.bottom);

  return {
    nodes: allNodes,
    edges: personEdges,
    width: stageWidth,
    height: stageHeight,
  };
}
