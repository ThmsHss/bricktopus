import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  connectInfo,
  connectNotion,
  connectSalesforce,
  disconnectNotion,
  disconnectSalesforce,
  sourcesStatus,
  syncCalendar,
  syncGmail,
  syncNotion,
} from "@/lib/api";

export type SourceName =
  | "google_calendar"
  | "gmail"
  | "notion"
  | "salesforce";

export type ConnectKind = "token" | "credentials" | "oauth-external";

export interface SourceStatus {
  name: SourceName;
  label: string;
  mode: "mock" | "live";
  authenticated: boolean;
  detail: string;
  connect_kind: ConnectKind;
}

const KEY = ["sources-status"];

export function useSourcesStatus() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await sourcesStatus();
      return (res.data.sources ?? []) as SourceStatus[];
    },
    staleTime: 30_000,
  });
}

export function useConnectInfo(source: SourceName | null) {
  return useQuery({
    queryKey: ["connect-info", source],
    queryFn: async () => {
      if (!source) return null;
      const res = await connectInfo({ source });
      return res.data;
    },
    enabled: source !== null,
    staleTime: Infinity,
  });
}

export function useConnectNotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { token: string; database_id?: string }) => {
      const res = await connectNotion(vars);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDisconnectNotionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await disconnectNotion();
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useConnectSalesforce() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      instance_url: string;
      username: string;
      password: string;
      security_token: string;
    }) => {
      const res = await connectSalesforce(vars);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDisconnectSalesforceAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await disconnectSalesforce();
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTriggerSync(source: SourceName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (source === "google_calendar") return (await syncCalendar()).data;
      if (source === "gmail") return (await syncGmail()).data;
      if (source === "notion") return (await syncNotion()).data;
      throw new Error("Salesforce sync not yet implemented.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
