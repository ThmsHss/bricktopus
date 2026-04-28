import { useQuery, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseSuspenseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
export class ApiError extends Error {
    status: number;
    statusText: string;
    body: unknown;
    constructor(status: number, statusText: string, body: unknown){
        super(`HTTP ${status}: ${statusText}`);
        this.name = "ApiError";
        this.status = status;
        this.statusText = statusText;
        this.body = body;
    }
}
export interface ComplexValue {
    display?: string | null;
    primary?: boolean | null;
    ref?: string | null;
    type?: string | null;
    value?: string | null;
}
export interface CustomerBucketEntry {
    by_type: Record<string, number>;
    customer_id: string;
    customer_name: string;
    minutes: number;
}
export interface CustomerTotal {
    customer_id: string;
    customer_name: string;
    minutes: number;
}
export interface HTTPValidationError {
    detail?: ValidationError[];
}
export interface Name {
    family_name?: string | null;
    given_name?: string | null;
}
export interface SourceStatusOut {
    authenticated: boolean;
    detail: string;
    mode: string;
    name: string;
}
export interface SourcesStatusOut {
    sources: SourceStatusOut[];
}
export interface SyncResultOut {
    inserted: number;
    mode: string;
    source: string;
    total: number;
    updated: number;
}
export interface TimeBucket {
    bucket_label: string;
    bucket_start: string;
    customer_breakdown: CustomerBucketEntry[];
    total_minutes: number;
}
export interface TimeSpentResponse {
    bucket: string;
    buckets: TimeBucket[];
    event_count: number;
    range_end: string;
    range_start: string;
    total_minutes: number;
    totals_by_customer: CustomerTotal[];
    totals_by_type: Record<string, number>;
}
export interface User {
    active?: boolean | null;
    display_name?: string | null;
    emails?: ComplexValue[] | null;
    entitlements?: ComplexValue[] | null;
    external_id?: string | null;
    groups?: ComplexValue[] | null;
    id?: string | null;
    name?: Name | null;
    roles?: ComplexValue[] | null;
    schemas?: UserSchema[] | null;
    user_name?: string | null;
}
export const UserSchema = {
    "urn:ietf:params:scim:schemas:core:2.0:User": "urn:ietf:params:scim:schemas:core:2.0:User",
    "urn:ietf:params:scim:schemas:extension:workspace:2.0:User": "urn:ietf:params:scim:schemas:extension:workspace:2.0:User"
} as const;
export type UserSchema = typeof UserSchema[keyof typeof UserSchema];
export interface ValidationError {
    ctx?: Record<string, unknown>;
    input?: unknown;
    loc: (string | number)[];
    msg: string;
    type: string;
}
export interface VersionOut {
    version: string;
}
export interface CurrentUserParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const currentUser = async (params?: CurrentUserParams, options?: RequestInit): Promise<{
    data: User;
}> =>{
    const res = await fetch("/api/current-user", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const currentUserKey = (params?: CurrentUserParams)=>{
    return [
        "/api/current-user",
        params
    ] as const;
};
export function useCurrentUser<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export function useCurrentUserSuspense<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export const version = async (options?: RequestInit): Promise<{
    data: VersionOut;
}> =>{
    const res = await fetch("/api/version", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const versionKey = ()=>{
    return [
        "/api/version"
    ] as const;
};
export function useVersion<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
export function useVersionSuspense<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
export const sourcesStatus = async (options?: RequestInit): Promise<{
    data: SourcesStatusOut;
}> =>{
    const res = await fetch("/sources/status", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const sourcesStatusKey = ()=>{
    return [
        "/sources/status"
    ] as const;
};
export function useSourcesStatus<TData = {
    data: SourcesStatusOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: SourcesStatusOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: sourcesStatusKey(),
        queryFn: ()=>sourcesStatus(),
        ...options?.query
    });
}
export function useSourcesStatusSuspense<TData = {
    data: SourcesStatusOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: SourcesStatusOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: sourcesStatusKey(),
        queryFn: ()=>sourcesStatus(),
        ...options?.query
    });
}
export interface SyncCalendarParams {
    days_back?: number;
    days_forward?: number;
}
export const syncCalendar = async (params?: SyncCalendarParams, options?: RequestInit): Promise<{
    data: SyncResultOut;
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.days_back != null) searchParams.set("days_back", String(params?.days_back));
    if (params?.days_forward != null) searchParams.set("days_forward", String(params?.days_forward));
    const queryString = searchParams.toString();
    const url = queryString ? `/sources/sync/calendar?${queryString}` : "/sources/sync/calendar";
    const res = await fetch(url, {
        ...options,
        method: "POST"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useSyncCalendar(options?: {
    mutation?: UseMutationOptions<{
        data: SyncResultOut;
    }, ApiError, {
        params: SyncCalendarParams;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>syncCalendar(vars.params),
        ...options?.mutation
    });
}
export interface SyncGmailParams {
    days_back?: number;
}
export const syncGmail = async (params?: SyncGmailParams, options?: RequestInit): Promise<{
    data: SyncResultOut;
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.days_back != null) searchParams.set("days_back", String(params?.days_back));
    const queryString = searchParams.toString();
    const url = queryString ? `/sources/sync/gmail?${queryString}` : "/sources/sync/gmail";
    const res = await fetch(url, {
        ...options,
        method: "POST"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useSyncGmail(options?: {
    mutation?: UseMutationOptions<{
        data: SyncResultOut;
    }, ApiError, {
        params: SyncGmailParams;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>syncGmail(vars.params),
        ...options?.mutation
    });
}
export interface SyncNotionParams {
    days_back?: number;
}
export const syncNotion = async (params?: SyncNotionParams, options?: RequestInit): Promise<{
    data: SyncResultOut;
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.days_back != null) searchParams.set("days_back", String(params?.days_back));
    const queryString = searchParams.toString();
    const url = queryString ? `/sources/sync/notion?${queryString}` : "/sources/sync/notion";
    const res = await fetch(url, {
        ...options,
        method: "POST"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useSyncNotion(options?: {
    mutation?: UseMutationOptions<{
        data: SyncResultOut;
    }, ApiError, {
        params: SyncNotionParams;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>syncNotion(vars.params),
        ...options?.mutation
    });
}
export interface GetTimeSpentParams {
    bucket?: "week" | "month";
    start?: string | null;
    end?: string | null;
}
export const getTimeSpent = async (params?: GetTimeSpentParams, options?: RequestInit): Promise<{
    data: TimeSpentResponse;
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.bucket != null) searchParams.set("bucket", String(params?.bucket));
    if (params?.start != null) searchParams.set("start", String(params?.start));
    if (params?.end != null) searchParams.set("end", String(params?.end));
    const queryString = searchParams.toString();
    const url = queryString ? `/time-spent?${queryString}` : "/time-spent";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getTimeSpentKey = (params?: GetTimeSpentParams)=>{
    return [
        "/time-spent",
        params
    ] as const;
};
export function useGetTimeSpent<TData = {
    data: TimeSpentResponse;
}>(options?: {
    params?: GetTimeSpentParams;
    query?: Omit<UseQueryOptions<{
        data: TimeSpentResponse;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getTimeSpentKey(options?.params),
        queryFn: ()=>getTimeSpent(options?.params),
        ...options?.query
    });
}
export function useGetTimeSpentSuspense<TData = {
    data: TimeSpentResponse;
}>(options?: {
    params?: GetTimeSpentParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: TimeSpentResponse;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getTimeSpentKey(options?.params),
        queryFn: ()=>getTimeSpent(options?.params),
        ...options?.query
    });
}
