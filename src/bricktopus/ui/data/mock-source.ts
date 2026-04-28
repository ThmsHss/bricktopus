import type { DataSource } from "./source";
import type {
  Customer,
  CustomerId,
  OntologyBundle,
  OverviewBundle,
} from "./types";
import { pumaOverview } from "./mock/puma";
import { pumaOntology } from "./mock/puma-ontology";

const MOCK_LATENCY_MS = 180;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mockCustomers: Customer[] = [
  pumaOverview.customer,
  {
    id: "adidas",
    name: "adidas",
    industry: "Retail & Apparel",
    region: "EMEA",
    hq: "Herzogenaurach, Germany",
    segment: "Strategic",
    lifecycleStage: "Renew",
    accountTeam: [],
  },
  {
    id: "lvmh",
    name: "LVMH",
    industry: "Luxury",
    region: "EMEA",
    hq: "Paris, France",
    segment: "Strategic",
    lifecycleStage: "Adopt",
    accountTeam: [],
  },
];

const overviewByCustomer: Record<string, OverviewBundle> = {
  puma: pumaOverview,
};

const ontologyByCustomer: Record<string, OntologyBundle> = {
  puma: pumaOntology,
};

export class MockDataSource implements DataSource {
  readonly mode = "mock" as const;

  async listCustomers(): Promise<Customer[]> {
    await wait(MOCK_LATENCY_MS);
    return mockCustomers;
  }

  async getOverview(customerId: CustomerId): Promise<OverviewBundle> {
    await wait(MOCK_LATENCY_MS);
    const overview = overviewByCustomer[customerId];
    if (!overview) {
      throw new Error(
        `No mock overview available for "${customerId}". Add a fixture under data/mock/.`,
      );
    }
    return overview;
  }

  async getOntology(customerId: CustomerId): Promise<OntologyBundle> {
    await wait(MOCK_LATENCY_MS);
    const ontology = ontologyByCustomer[customerId];
    if (!ontology) {
      throw new Error(
        `No mock ontology available for "${customerId}". Add a fixture under data/mock/.`,
      );
    }
    return ontology;
  }
}
