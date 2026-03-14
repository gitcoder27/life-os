export type IsoDateString = `${number}-${number}-${number}`;
export type IsoMonthString = `${number}-${number}`;
export type EntityId = string;

export type LifecycleStatus = "active" | "inactive";

export interface ApiMeta {
  generatedAt: string;
}

export interface ApiSuccess {
  success: true;
}

export interface ApiError {
  success: false;
  message: string;
}
