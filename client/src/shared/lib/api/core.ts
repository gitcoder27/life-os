import type { QueryClient } from "@tanstack/react-query";
import type {
  ApiError,
  ApiFieldError,
} from "@life-os/contracts";
import {
  getMonthString,
  getPreferredTimezone,
  getWeekStartDate,
  toIsoDate,
} from "../date";

type SectionError = {
  message: string;
};

type TaskQueryKeyFilters = {
  scheduledForDate?: string;
  from?: string;
  to?: string;
  completedOn?: string;
  status?: string;
  kind?: string;
  cursor?: string;
  limit?: number;
  includeSummary?: boolean;
  originType?: string;
  scheduledState?: string;
  sort?: string;
};

type ReviewHistoryQueryKeyParams = {
  cadence?: string;
  range?: string;
  q?: string;
  cursor?: string;
};

export type CoreInvalidationDomain =
  | "tasks"
  | "home"
  | "focus"
  | "score"
  | "planning"
  | "habits"
  | "health"
  | "finance"
  | "goals"
  | "review"
  | "reviewHistory"
  | "notifications";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const CSRF_COOKIE_NAME = (import.meta.env.VITE_CSRF_COOKIE_NAME ?? "").trim();
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiClientError extends Error {
  status: number;
  code: string;
  fieldErrors?: ApiFieldError[];

  constructor(status: number, payload?: Partial<ApiError>) {
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
  scoreHistory: (date: string, days: number) => ["score", "history", date, days] as const,
  weeklyMomentum: (date: string) => ["score", "weekly-momentum", date] as const,
  dayPlan: (date: string) => ["planning", "day", date] as const,
  adaptiveToday: (date: string) => ["planning", "day", date, "adaptive"] as const,
  dayCapacity: (date: string) => ["planning", "day", date, "capacity"] as const,
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
      filters.sort ?? "newest",
      filters.completedOn ?? "all",
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
    return (await response.json()) as ApiError;
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

const isString = (value: unknown): value is string => typeof value === "string";

const addIsoDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

const dateFallsInTrailingWindow = (date: string, endingOn: string, days: number) =>
  date <= endingOn && date >= addIsoDays(endingOn, -(days - 1));

const scoreAggregateQueryTouchesDate = (queryKey: readonly unknown[], date: string) => {
  if (queryKey[0] !== "score") {
    return false;
  }

  if (queryKey[1] === "weekly-momentum" && isString(queryKey[2])) {
    return dateFallsInTrailingWindow(date, queryKey[2], 7);
  }

  if (queryKey[1] === "history" && isString(queryKey[2])) {
    const days = typeof queryKey[3] === "number" ? queryKey[3] : Number(queryKey[3]);

    return Number.isFinite(days) && dateFallsInTrailingWindow(date, queryKey[2], days);
  }

  return false;
};

const homeQueryTouchesDate = (queryKey: readonly unknown[], date: string) => {
  if (queryKey[0] !== "home" || !isString(queryKey[1])) {
    return false;
  }

  return dateFallsInTrailingWindow(date, queryKey[1], 7);
};

export const taskQueryTouchesDate = (queryKey: readonly unknown[], date: string) => {
  if (queryKey[0] !== "tasks") {
    return false;
  }

  const scheduledForDate = queryKey[1];
  const from = queryKey[2];
  const to = queryKey[3];
  const scheduledState = queryKey[10];
  const completedOn = queryKey[12];

  if (scheduledForDate === date) {
    return true;
  }

  if (completedOn === date) {
    return true;
  }

  if (isString(completedOn) && completedOn !== "all") {
    return false;
  }

  if (isString(from) && isString(to) && from !== "all" && to !== "all") {
    return from <= date && date <= to;
  }

  return scheduledForDate === "all" &&
    from === "all" &&
    to === "all" &&
    scheduledState !== "unscheduled";
};

export const taskQueryTracksUnscheduledTasks = (queryKey: readonly unknown[]) => {
  if (queryKey[0] !== "tasks") {
    return false;
  }

  const scheduledForDate = queryKey[1];
  const from = queryKey[2];
  const to = queryKey[3];
  const scheduledState = queryKey[10];

  return scheduledForDate === "all" &&
    from === "all" &&
    to === "all" &&
    scheduledState === "unscheduled";
};

const taskQueryShouldRefreshForCoreMutation = (queryKey: readonly unknown[], date: string) =>
  taskQueryTouchesDate(queryKey, date) || taskQueryTracksUnscheduledTasks(queryKey);

export const invalidateCoreData = (
  queryClient: QueryClient,
  date: string,
  options: {
    domains?: CoreInvalidationDomain[];
  } = {},
) => {
  const domains = new Set<CoreInvalidationDomain>(
    options.domains ?? [
      "tasks",
      "home",
      "focus",
      "score",
      "planning",
      "goals",
      "review",
      "notifications",
    ],
  );

  if (domains.has("tasks")) {
    void queryClient.invalidateQueries({
      predicate: (query) => taskQueryShouldRefreshForCoreMutation(query.queryKey, date),
    });
  }

  if (domains.has("home")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.home(date) });
    void queryClient.invalidateQueries({
      predicate: (query) => homeQueryTouchesDate(query.queryKey, date),
    });
  }

  if (domains.has("focus")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.focusActive });
  }

  if (domains.has("score")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.score(date) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.weeklyMomentum(date) });
    void queryClient.invalidateQueries({
      predicate: (query) => scoreAggregateQueryTouchesDate(query.queryKey, date),
    });
  }

  if (domains.has("planning")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dayPlan(date) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adaptiveToday(date) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dayCapacity(date) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.weekPlan(getWeekStartDate(date)) });
  }

  if (domains.has("habits")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.habits });
  }

  if (domains.has("health")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.health(date) });
  }

  if (domains.has("finance")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.finance(getMonthString(date)) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.financeCategories });
    void queryClient.invalidateQueries({ queryKey: queryKeys.financeRecurring });
  }

  if (domains.has("goals")) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.goals(getWeekStartDate(date), `${getMonthString(date)}-01`),
    });
  }

  if (domains.has("review")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.review("daily", date) });
  }

  if (domains.has("reviewHistory")) {
    void queryClient.invalidateQueries({ queryKey: ["reviewHistory"] });
  }

  if (domains.has("notifications")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }
};

export const invalidateCoreDataForDates = (
  queryClient: QueryClient,
  dates: Array<string | null | undefined>,
  options: {
    domains?: CoreInvalidationDomain[];
  } = {},
) => {
  const uniqueDates = [...new Set(dates.filter((date): date is string => Boolean(date)))];

  for (const date of uniqueDates) {
    invalidateCoreData(queryClient, date, options);
  }
};

export const invalidateTaskTemplateData = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.taskTemplates });
};
