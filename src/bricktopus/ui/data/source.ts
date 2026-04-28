import type { Customer, CustomerId, OverviewBundle } from "./types";

/**
 * Single abstraction for everything the dashboard needs.
 *
 * Mock and real implementations both satisfy this interface so the UI never
 * has to care about where data comes from.
 */
export interface DataSource {
  readonly mode: "mock" | "real";
  listCustomers(): Promise<Customer[]>;
  getOverview(customerId: CustomerId): Promise<OverviewBundle>;
}
