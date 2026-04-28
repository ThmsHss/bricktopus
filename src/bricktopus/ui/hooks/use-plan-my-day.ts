import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

// ---------- Types (mirror DailyBriefingOut on the backend) ----------

export interface AttendeeBriefing {
  email: string;
  domain: string;
  is_internal: boolean;
  classification: string | null;
}

export interface NotionExcerpt {
  id: string;
  title: string;
  url: string | null;
  last_edited_at: string;
  excerpt: string | null;
}

export interface EmailExcerpt {
  id: string;
  subject: string;
  snippet: string | null;
  last_message_at: string;
  participant_count: number;
}

export interface MeetingBriefingItem {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  meeting_type: string;
  is_customer_facing: boolean;
  is_internal: boolean;
  is_self_organized: boolean;
  customer_id: string | null;
  customer_name: string | null;
  attendees: AttendeeBriefing[];
  prior_meeting_count: number;
  last_contact_days_ago: number | null;
  notion_note: NotionExcerpt | null;
  latest_email: EmailExcerpt | null;
  recommendation: string;
  calendar_url: string | null;
}

export interface CustomerChip {
  customer_id: string;
  customer_name: string;
  meeting_count: number;
}

export interface DailySummary {
  day: string;
  user_email: string;
  total_meeting_minutes: number;
  customer_facing_minutes: number;
  internal_minutes: number;
  customer_facing_share: number;
  customers: CustomerChip[];
  meeting_count: number;
}

export interface DailyBriefingOut {
  summary: DailySummary;
  meetings: MeetingBriefingItem[];
  generated_at: string;
  notes: string[];
}

async function fetchDailyBriefing(day?: string): Promise<DailyBriefingOut> {
  const url = day
    ? `/api/plan-my-day?day=${encodeURIComponent(day)}`
    : "/api/plan-my-day";
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // body stays as text
    }
    throw new ApiError(res.status, res.statusText, body);
  }
  return (await res.json()) as DailyBriefingOut;
}

export function usePlanMyDay(day?: string) {
  return useQuery<DailyBriefingOut, ApiError>({
    queryKey: ["plan-my-day", day ?? "today"],
    queryFn: () => fetchDailyBriefing(day),
    staleTime: 60_000,
  });
}
