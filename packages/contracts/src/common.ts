export type IsoDateString = `${number}-${number}-${number}`;
export type IsoMonthString = `${number}-${number}`;
export type EntityId = string;

export type LifecycleStatus = "active" | "inactive";
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "REVIEW_OUT_OF_WINDOW"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiMeta {
  generatedAt: string;
}

export interface ApiSuccess {
  success: true;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError extends ApiMeta {
  success: false;
  code: ApiErrorCode;
  message: string;
  fieldErrors?: ApiFieldError[];
}
