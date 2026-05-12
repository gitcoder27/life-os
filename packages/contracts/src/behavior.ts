import type { ApiMeta, IsoDateString } from "./common.js";
import type { HomeAction } from "./home.js";
import type { AdaptiveNextMove } from "./planning.js";

export type BehaviorState =
  | "clear"
  | "stuck"
  | "overloaded"
  | "drifting"
  | "low_energy"
  | "recovery"
  | "maintenance";

export type BehaviorStateSeverity = "neutral" | "helpful" | "attention" | "urgent";

export type BehaviorStateSignalKey =
  | "focus_active"
  | "rescue_mode"
  | "missed_day_pattern"
  | "low_energy"
  | "slipped_work"
  | "current_block_at_risk"
  | "over_capacity"
  | "too_many_tasks"
  | "overdue_pressure"
  | "must_win_unclear"
  | "must_win_stuck"
  | "must_win_not_started"
  | "no_pending_work"
  | "next_move_ready";

export interface BehaviorStateSignal {
  key: BehaviorStateSignalKey;
  label: string;
  detail: string | null;
}

export interface BehaviorStateSnapshot {
  date: IsoDateString;
  state: BehaviorState;
  severity: BehaviorStateSeverity;
  label: string;
  title: string;
  reason: string;
  signals: BehaviorStateSignal[];
  nextMove: AdaptiveNextMove;
  homeAction: HomeAction;
}

export interface BehaviorStateResponse extends ApiMeta {
  date: IsoDateString;
  behaviorState: BehaviorStateSnapshot;
}
