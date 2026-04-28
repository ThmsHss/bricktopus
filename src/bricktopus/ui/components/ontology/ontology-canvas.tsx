import { useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { OntologyBundle, OntologyWorkspace } from "@/data";
import {
  buildSwimlaneLayout,
  PERSON_NODE_HEIGHT,
  USECASE_NODE_HEIGHT,
  USECASE_NODE_WIDTH,
  MEETING_NODE_HEIGHT,
  MEETING_NODE_WIDTH,
} from "./layout";
import { PersonNode } from "./person-node";
import {
  MeetingNoteNode,
  UseCaseNode,
  type MeetingNodeData,
  type UseCaseNodeData,
} from "./overlay-nodes";
import { ColumnHeader, GroupBand, GroupPanel } from "./structure-nodes";
import type { Classification } from "@/lib/classification";

export interface OntologyLayers {
  useCases: boolean;
  meetingNotes: boolean;
}

interface OntologyCanvasProps {
  ontology: OntologyBundle;
  layers: OntologyLayers;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  classifications: Record<string, Classification>;
}

const nodeTypes: NodeTypes = {
  person: PersonNode,
  useCase: UseCaseNode,
  meetingNote: MeetingNoteNode,
  groupBand: GroupBand,
  columnHeader: ColumnHeader,
  groupPanel: GroupPanel,
};

export function OntologyCanvas({
  ontology,
  layers,
  selectedNodeId,
  onSelectNode,
  classifications,
}: OntologyCanvasProps) {
  const { allNodes, allEdges } = useMemo(() => {
    // Inject person-node interaction props into the swimlane layout output
    const swimlane = buildSwimlaneLayout(ontology);
    const personNodes = swimlane.nodes.map((n) => {
      if (n.type !== "person") return n;
      return {
        ...n,
        data: {
          ...(n.data ?? {}),
          classification: classifications[n.id] ?? null,
          selected: selectedNodeId === n.id,
          onSelect: onSelectNode,
        },
      };
    });

    // Find the bottom of the people stage so overlays sit beneath it
    const personBottom = personNodes
      .filter((n) => n.type === "person")
      .reduce((acc, n) => Math.max(acc, n.position.y + PERSON_NODE_HEIGHT), 0);

    const overlayNodes: Node[] = [];
    const overlayEdges: Edge[] = [];

    // Workspace lookup so use-case nodes can render workspace chips inline
    const workspaceById = new Map<string, OntologyWorkspace>(
      ontology.workspaces.map((w) => [w.id, w]),
    );

    if (layers.useCases) {
      const useCaseY = personBottom + 80;
      const stride = USECASE_NODE_WIDTH + 20;

      // Position use cases roughly under the average X of their sponsor nodes,
      // resolving collisions by sliding right.
      const occupied: { left: number; right: number }[] = [];
      ontology.useCases.forEach((uc, idx) => {
        const sponsorXs = uc.sponsorIds
          .map((sid) => personNodes.find((n) => n.id === sid))
          .filter((n): n is NonNullable<typeof n> => Boolean(n))
          .map((n) => n.position.x);
        const baseX =
          sponsorXs.length > 0
            ? sponsorXs.reduce((a, b) => a + b, 0) / sponsorXs.length
            : (idx % 6) * stride;
        let x = baseX;
        // Resolve overlap with already-placed cards
        while (
          occupied.some(
            (o) => x < o.right + 12 && x + USECASE_NODE_WIDTH > o.left - 12,
          )
        ) {
          x += stride / 2;
        }
        occupied.push({ left: x, right: x + USECASE_NODE_WIDTH });

        const linkedWorkspaces = (uc.workspaceIds ?? [])
          .map((wid) => workspaceById.get(wid))
          .filter((w): w is OntologyWorkspace => Boolean(w));

        overlayNodes.push({
          id: uc.id,
          type: "useCase",
          position: { x, y: useCaseY },
          data: {
            useCase: uc,
            workspaces: linkedWorkspaces,
            selected: selectedNodeId === uc.id,
            onSelect: onSelectNode,
          } satisfies UseCaseNodeData,
          width: USECASE_NODE_WIDTH,
          height: USECASE_NODE_HEIGHT,
        });
        uc.sponsorIds.forEach((sid) => {
          overlayEdges.push({
            id: `e-uc-${sid}-${uc.id}`,
            source: sid,
            target: uc.id,
            type: "smoothstep",
            style: {
              stroke: "var(--chart-3)",
              strokeWidth: 1,
              strokeDasharray: "4 3",
              opacity: 0.55,
            },
          });
        });
      });
    }

    if (layers.meetingNotes) {
      const meetingY =
        personBottom + (layers.useCases ? 80 + USECASE_NODE_HEIGHT + 60 : 80);
      const stride = MEETING_NODE_WIDTH + 16;
      const startX = 32;

      ontology.meetingNotes.forEach((mn, i) => {
        const x = startX + i * stride;
        overlayNodes.push({
          id: mn.id,
          type: "meetingNote",
          position: { x, y: meetingY },
          data: {
            note: mn,
            selected: selectedNodeId === mn.id,
            onSelect: onSelectNode,
          } satisfies MeetingNodeData,
          width: MEETING_NODE_WIDTH,
          height: MEETING_NODE_HEIGHT,
        });
        mn.attendeeIds.forEach((aid) => {
          overlayEdges.push({
            id: `e-mn-${aid}-${mn.id}`,
            source: aid,
            target: mn.id,
            type: "smoothstep",
            style: {
              stroke: "var(--chart-4)",
              strokeWidth: 1,
              strokeDasharray: "4 3",
              opacity: 0.45,
            },
          });
        });
      });
    }

    return {
      allNodes: [...personNodes, ...overlayNodes],
      allEdges: [...swimlane.edges, ...overlayEdges],
    };
  }, [ontology, layers, selectedNodeId, onSelectNode, classifications]);

  const layerKey = `${layers.useCases}-${layers.meetingNotes}`;

  return (
    <ReactFlow
      key={layerKey}
      nodes={allNodes}
      edges={allEdges}
      nodeTypes={nodeTypes}
      proOptions={{ hideAttribution: true }}
      fitView
      fitViewOptions={{ padding: 0.06, minZoom: 0.4, maxZoom: 1 }}
      minZoom={0.25}
      maxZoom={1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      selectNodesOnDrag={false}
      onNodeClick={(_e, node) => {
        if (
          node.type === "groupBand" ||
          node.type === "groupPanel" ||
          node.type === "columnHeader"
        ) {
          return;
        }
        onSelectNode(node.id);
      }}
      onPaneClick={() => onSelectNode(null)}
      className="bg-background"
    >
      <Background color="var(--border)" gap={28} size={1} />
      <Controls
        showInteractive={false}
        className="!bg-card !border !border-border !shadow-sm [&_button]:!bg-transparent [&_button]:!text-muted-foreground hover:[&_button]:!text-foreground [&_button]:!border-border"
      />
    </ReactFlow>
  );
}
