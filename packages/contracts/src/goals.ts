import type { ApiMeta, EntityId, IsoDateString } from "./common.js";

export type GoalDomain = "health" | "money" | "work_growth" | "home_admin" | "discipline" | "other";
export type GoalStatus = "active" | "paused" | "completed" | "archived";

export interface GoalItem {
  id: EntityId;
  title: string;
  domain: GoalDomain;
  status: GoalStatus;
  targetDate: IsoDateString | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalsResponse extends ApiMeta {
  goals: GoalItem[];
}

export interface CreateGoalRequest {
  title: string;
  domain: GoalDomain;
  targetDate?: IsoDateString | null;
  notes?: string | null;
}

export interface UpdateGoalRequest {
  title?: string;
  domain?: GoalDomain;
  status?: GoalStatus;
  targetDate?: IsoDateString | null;
  notes?: string | null;
}

export interface GoalMutationResponse extends ApiMeta {
  goal: GoalItem;
}
