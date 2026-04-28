import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Network, Upload } from "lucide-react";
import { useOntology } from "@/hooks/use-overview";
import { useClassifications } from "@/hooks/use-classifications";
import { useBricktopus } from "@/data/context";
import {
  OntologyCanvas,
  type OntologyLayers,
} from "@/components/ontology/ontology-canvas";
import { LayerToggles } from "@/components/ontology/layer-toggles";
import { DetailPanel } from "@/components/ontology/detail-panel";
import { GapPanel } from "@/components/ontology/gap-panel";
import { PeerPanel } from "@/components/ontology/peer-panel";
import { ImportDialog } from "@/components/ontology/import-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_sidebar/ontology")({
  component: OntologyRoute,
});

function OntologyRoute() {
  const { data, isPending, error } = useOntology();
  const { classifications } = useClassifications();
  const { customerId } = useBricktopus();
  const [layers, setLayers] = useState<OntologyLayers>({
    useCases: false,
    meetingNotes: false,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  if (isPending) return <OntologyLoading />;

  if (error || !data) {
    return (
      <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wider">
            Ontology unavailable
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? "No ontology returned for this customer."}
        </p>
      </div>
    );
  }

  const stats = `${data.persons.length} people · ${data.workspaces.length} workspaces · ${data.useCases.length} use cases · ${data.meetingNotes.length} meeting notes`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 pb-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Network className="h-3.5 w-3.5" />
          Customer ontology
        </div>
        <h1 className="font-display text-4xl tracking-tight leading-none">
          Ontology
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          People grouped by Central IT and Business Unit, with workspaces
          mapped into the use cases they run on. Toggle layers to surface use
          cases and meeting notes; click any node for full context.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border bg-card/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex flex-wrap items-center gap-3">
            <LayerToggles layers={layers} onChange={setLayers} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="gap-1.5 rounded-full"
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </Button>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {stats}
          </div>
        </div>
        <div className="h-[72vh] min-h-[560px] overflow-hidden rounded-lg border bg-background">
          <OntologyCanvas
            ontology={data}
            layers={layers}
            selectedNodeId={selectedId}
            onSelectNode={setSelectedId}
            classifications={classifications}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
          <GapPanel ontology={data} />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <PeerPanel peers={data.peers} />
        </div>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        defaultCustomerId={customerId}
      />

      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full p-0 sm:max-w-[440px] [&>button]:hidden"
        >
          <SheetTitle className="sr-only">Ontology detail</SheetTitle>
          {selectedId && (
            <DetailPanel
              ontology={data}
              selectedId={selectedId}
              onClose={() => setSelectedId(null)}
              onSelect={setSelectedId}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OntologyLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-3 w-96" />
      </div>
      <Skeleton className="h-[72vh] min-h-[560px] rounded-xl" />
    </div>
  );
}
