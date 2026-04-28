import type { DataSource } from "./source";
import type {
  Customer,
  CustomerId,
  OntologyBundle,
  OverviewBundle,
} from "./types";

/**
 * Stub for the real data source.
 *
 * Future wiring: Salesforce (account team, UCOs), Logfood (consumption +
 * anomalies), Slack + Gmail (interactions), Glean + Google Drive (notes),
 * org-chart enrichment. For now this throws so the UI can flag that real
 * mode is not yet implemented.
 */
export class RealDataSource implements DataSource {
  readonly mode = "real" as const;

  async listCustomers(): Promise<Customer[]> {
    throw new RealNotImplementedError("listCustomers");
  }

  async getOverview(_customerId: CustomerId): Promise<OverviewBundle> {
    throw new RealNotImplementedError("getOverview");
  }

  async getOntology(_customerId: CustomerId): Promise<OntologyBundle> {
    throw new RealNotImplementedError("getOntology");
  }
}

export class RealNotImplementedError extends Error {
  constructor(operation: string) {
    super(
      `Real data source is not wired up yet (operation: ${operation}). ` +
        `Toggle back to mock mode for now.`,
    );
    this.name = "RealNotImplementedError";
  }
}
