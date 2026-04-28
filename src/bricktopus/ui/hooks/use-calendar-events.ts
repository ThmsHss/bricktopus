import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export interface CalendarEventRow {
  id: string;
  summary: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  organizer_email: string | null;
  response_status: string | null;
  self_organized: boolean;
  is_all_day: boolean;
  attendee_count: number;
  customer_id: string | null;
  customer_name: string | null;
  meeting_type: string | null;
  classification_source: string | null;
}

export interface CustomerOption {
  customer_id: string;
  customer_name: string;
}

export const MEETING_TYPES = [
  "discovery",
  "demo",
  "cadence",
  "deep-dive",
  "prep",
  "admin",
  "other",
] as const;

export type MeetingType = (typeof MEETING_TYPES)[number];

interface ListParams {
  customer_id?: string | null;
  start?: string;
  end?: string;
  limit?: number;
}

const KEY = (params: ListParams) => ["calendar-events", params];

export function useCalendarEvents(params: ListParams) {
  return useQuery<{ events: CalendarEventRow[]; total: number }>({
    queryKey: KEY(params),
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params.customer_id !== undefined && params.customer_id !== null) {
        search.set("customer_id", params.customer_id);
      }
      if (params.start) search.set("start", params.start);
      if (params.end) search.set("end", params.end);
      if (params.limit) search.set("limit", String(params.limit));
      const res = await fetch(`/api/calendar-events?${search.toString()}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useCustomerOptions() {
  return useQuery<{ customers: CustomerOption[] }>({
    queryKey: ["customer-options"],
    queryFn: async () => {
      const res = await fetch("/api/calendar-events/customer-options");
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

interface PatchVars {
  event_id: string;
  customer_id: string | null;
  meeting_type: MeetingType | null;
}

export function useUpdateEventClassification() {
  const qc = useQueryClient();
  return useMutation<CalendarEventRow, Error, PatchVars>({
    mutationFn: async ({ event_id, customer_id, meeting_type }) => {
      const res = await fetch(
        `/api/calendar-events/${encodeURIComponent(event_id)}/classification`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_id, meeting_type }),
        },
      );
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["time-spent"] });
    },
  });
}
