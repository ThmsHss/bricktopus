import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

export type TimeSpentBucket = "week" | "month";

export interface TimeSpentCustomerEntry {
  customer_id: string;
  customer_name: string;
  minutes: number;
  by_type: Record<string, number>;
}

export interface TimeSpentBucketEntry {
  bucket_start: string;
  bucket_label: string;
  customer_breakdown: TimeSpentCustomerEntry[];
  total_minutes: number;
}

export interface TimeSpentCustomerTotal {
  customer_id: string;
  customer_name: string;
  minutes: number;
}

export interface TimeSpentResponse {
  buckets: TimeSpentBucketEntry[];
  totals_by_customer: TimeSpentCustomerTotal[];
  totals_by_type: Record<string, number>;
  range_start: string;
  range_end: string;
  bucket: string;
  total_minutes: number;
  event_count: number;
}

export interface UseTimeSpentOptions {
  bucket: TimeSpentBucket;
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
}

async function fetchTimeSpent(
  options: UseTimeSpentOptions,
): Promise<TimeSpentResponse> {
  const search = new URLSearchParams({ bucket: options.bucket });
  if (options.start) search.set("start", options.start);
  if (options.end) search.set("end", options.end);
  const res = await fetch(`/api/time-spent?${search.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = body;
    }
    throw new ApiError(res.status, res.statusText, parsed);
  }
  return (await res.json()) as TimeSpentResponse;
}

export function useTimeSpent(options: UseTimeSpentOptions) {
  return useQuery<TimeSpentResponse, ApiError>({
    queryKey: ["time-spent", options.bucket, options.start, options.end],
    queryFn: () => fetchTimeSpent(options),
    staleTime: 60_000,
  });
}

export interface SyncCalendarResponse {
  source: string;
  mode: string;
  inserted: number;
  updated: number;
  total: number;
}

export async function triggerCalendarSync(): Promise<SyncCalendarResponse> {
  const res = await fetch("/api/sources/sync/calendar", { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = body;
    }
    throw new ApiError(res.status, res.statusText, parsed);
  }
  return (await res.json()) as SyncCalendarResponse;
}
