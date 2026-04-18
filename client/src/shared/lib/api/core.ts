import type { QueryClient } from "@tanstack/react-query";
import { getPreferredTimezone } from "../date";

type ApiFieldError = {
  field: string;
  message: string;
};

type ApiErrorResponse = {
  success: false;
  code: string;
  message: string;
  fieldErrors?: ApiFieldError[];
  generatedAt: string;
};

type SectionError = {
  message: string;
};

type TaskQueryKeyFilters = {
  scheduledForDate?: string;
  from?: string;
  to?: string;
  status?: string;
  kind?: string;
  cursor?: string;
  limit?: number;
  includeSummary?: boolean;
  originType?: string;
  scheduledState?: string;
};

type ReviewHistoryQueryKeyParams = {
  cadence?: string;
  range?: string;
  q?: string;
  cursor?: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const CSRF_COOKIE_NAME = (import.meta.env.VITE_CSRF_COOKIE_NAME ?? "").trim();
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiClientError extends Error {
  status: number;
  code: string;
  fieldErrors?: ApiFieldError[];

  constructor(status: number, payload?: Partial<ApiErrorResponse>) {
    super(payload?.message ?? "Request failed");
    this.name = "ApiClientError";
    this.status = status;
    this.code = payload?.code ?? "UNKNOWN";
    this.fieldErrors = payload?.fieldErrors;
  }
}

export const queryKeys = {
  session: ["session"] as const,
  onboarding: ["onboarding"] as const,
  home: (date: string) => ["home", date] as const,
  homeQuote: ["home", "quote"] as const,
  focusActive: ["focus", "active"] as const,
  score: (date: string) => ["score", "daily", date] as const,
  weeklyMomentum: (date: string) => ["score", "weekly-momentum", date] as const,
  dayPlan: (date: string) => ["planning", "day", date] as const,
  weekPlan: (startDate: string) => ["planning", "week", startDate] as const,
  tasks: (filters: TaskQueryKeyFilters = {}) =>
    [
      "tasks",
      filters.scheduledForDate ?? "all",
      filters.from ?? "all",
      filters.to ?? "all",
      filters.status ?? "all",
      filters.kind ?? "all",
      filters.cursor ?? "",
      filters.limit ?? "all",
      filters.includeSummary ? "summary" : "no-summary",
      filters.originType ?? "all",
      filters.scheduledState ?? "all",
    ] as const,
  habits: ["habits"] as const,
  health: (date: string) => ["health", date] as const,
  finance: (month: string) => ["finance", month] as const,
  financeCategories: ["finance", "categories"] as const,
  financeRecurring: ["finance", "recurring"] as const,
  goals: (weekStart: string, monthStart: string) => ["goals", weekStart, monthStart] as const,
  goalsAll: ["goals", "all"] as const,
  goalsFiltered: (domain?: string, status?: string) =>
    ["goals", "filtered", domain ?? "all", status ?? "all"] as const,
  goalDetail: (goalId: string) => ["goals", "detail", goalId] as const,
  review: (cadence: string, dateKey: string) => ["review", cadence, dateKey] as const,
  reviewHistory: (params: ReviewHistoryQueryKeyParams) =>
    ["reviewHistory", params.cadence ?? "all", params.range ?? "90d", params.q ?? "", params.cursor ?? ""] as const,
  notifications: ["notifications"] as const,
  settings: ["settings"] as const,
  mealTemplates: ["health", "meal-templates"] as const,
  mealPlanWeek: (startDate: string) => ["mealPlanWeek", startDate] as const,
  taskTemplates: ["planning", "task-templates"] as const,
};

const buildUrl = (path: string, query?: Record<string, string | undefined>) => {
  const base = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  const url = API_BASE_URL ? new URL(base) : new URL(path, window.location.origin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
};

const getCookie = (name: string) => {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
};

const getCsrfToken = () => {
  if (!CSRF_COOKIE_NAME) {
    throw new Error("Missing VITE_CSRF_COOKIE_NAME in the frontend build configuration.");
  }

  return getCookie(CSRF_COOKIE_NAME);
};

const getClientTimezone = () => {
  const candidates = [
    getPreferredTimezone(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: candidate });
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
};

const readErrorPayload = async (response: Response) => {
  try {
    return (await response.json()) as ApiErrorResponse;
  } catch {
    return undefined;
  }
};

export const toSectionError = (error: unknown, fallback: string): SectionError => {
  if (error instanceof Error && error.message.trim()) {
    return {
      message: error.message,
    };
  }

  return {
    message: fallback,
  };
};

export const unwrapRequiredResult = <T>(
  result: PromiseSettledResult<T>,
  fallback: string,
) => {
  if (result.status === "fulfilled") {
    return result.value;
  }

  throw result.reason instanceof Error ? result.reason : new Error(fallback);
};

export const apiRequest = async <TResponse>(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    headers?: HeadersInit;
    query?: Record<string, string | undefined>;
  },
): Promise<TResponse> => {
  const method = init?.method ?? "GET";
  const headers = new Headers(init?.headers);

  if (init?.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const clientTimezone = getClientTimezone();
  if (clientTimezone) {
    headers.set("x-client-timezone", clientTimezone);
  }

  if (!SAFE_METHODS.has(method.toUpperCase()) && path !== "/api/auth/login") {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set("x-csrf-token", csrfToken);
    }
  }

  const response = await fetch(buildUrl(path, init?.query), {
    method,
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw new ApiClientError(response.status, payload);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
};

export const invalidateCoreData = (queryClient: QueryClient, _date: string) => {
  void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  void queryClient.invalidateQueries({ queryKey: ["home"] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.focusActive });
  void queryClient.invalidateQueries({ queryKey: ["score"] });
  void queryClient.invalidateQueries({ queryKey: ["planning", "day"] });
  void queryClient.invalidateQueries({ queryKey: ["planning", "week"] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.habits });
  void queryClient.invalidateQueries({ queryKey: ["health"] });
  void queryClient.invalidateQueries({ queryKey: ["finance"] });
  void queryClient.invalidateQueries({ queryKey: ["goals"] });
  void queryClient.invalidateQueries({ queryKey: ["review"] });
  void queryClient.invalidateQueries({ queryKey: ["reviewHistory"] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
};

export const invalidateTaskTemplateData = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.taskTemplates });
};
