import type {
  GoalDomainSystemKey,
  GoalEngagementState,
  GoalStatus,
  GoalSummary,
  TaskKind,
  TaskOriginType,
} from "@life-os/contracts";
import type {
  GoalDomainSystemKey as PrismaGoalDomainSystemKey,
  GoalEngagementState as PrismaGoalEngagementState,
  GoalStatus as PrismaGoalStatus,
  TaskKind as PrismaTaskKind,
  TaskOriginType as PrismaTaskOriginType,
} from "@prisma/client";

export type HomeGoalSummaryRecord = {
  id: string;
  title: string;
  domainId: string;
  domain: {
    id: string;
    name: string;
    systemKey: PrismaGoalDomainSystemKey | null;
  };
  status: PrismaGoalStatus;
  engagementState?: PrismaGoalEngagementState | null;
};

const fromPrismaGoalDomainSystemKey = (
  systemKey: PrismaGoalDomainSystemKey | null,
): GoalDomainSystemKey | null => {
  switch (systemKey) {
    case "UNASSIGNED":
      return "unassigned";
    case "HEALTH":
      return "health";
    case "MONEY":
      return "money";
    case "WORK_GROWTH":
      return "work_growth";
    case "HOME_ADMIN":
      return "home_admin";
    case "DISCIPLINE":
      return "discipline";
    case "OTHER":
      return "other";
    default:
      return null;
  }
};

const fromPrismaGoalStatus = (status: PrismaGoalStatus): GoalStatus => {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
      return "paused";
    case "COMPLETED":
      return "completed";
    case "ARCHIVED":
      return "archived";
  }
};

const fromPrismaGoalEngagementState = (
  engagementState: PrismaGoalEngagementState | null | undefined,
): GoalEngagementState | null => {
  switch (engagementState) {
    case "PRIMARY":
      return "primary";
    case "SECONDARY":
      return "secondary";
    case "PARKED":
      return "parked";
    case "MAINTENANCE":
      return "maintenance";
    default:
      return null;
  }
};

const fromPrismaTaskKind = (kind: PrismaTaskKind): TaskKind => {
  switch (kind) {
    case "TASK":
      return "task";
    case "NOTE":
      return "note";
    case "REMINDER":
      return "reminder";
  }
};

const fromPrismaTaskOriginType = (originType: PrismaTaskOriginType): TaskOriginType => {
  switch (originType) {
    case "MANUAL":
      return "manual";
    case "QUICK_CAPTURE":
      return "quick_capture";
    case "CARRY_FORWARD":
      return "carry_forward";
    case "REVIEW_SEED":
      return "review_seed";
    case "RECURRING":
      return "recurring";
    case "TEMPLATE":
      return "template";
    case "MEAL_PLAN":
      return "meal_plan";
  }
};

export const serializeHomeGoalSummary = (goal: HomeGoalSummaryRecord): GoalSummary => ({
  id: goal.id,
  title: goal.title,
  domainId: goal.domainId,
  domain: goal.domain.name,
  domainSystemKey: fromPrismaGoalDomainSystemKey(goal.domain.systemKey),
  status: fromPrismaGoalStatus(goal.status),
  engagementState: fromPrismaGoalEngagementState(goal.engagementState),
});

export const toHomeTaskKind = (kind: PrismaTaskKind): TaskKind => fromPrismaTaskKind(kind);

export const toHomeTaskOriginType = (originType: PrismaTaskOriginType): TaskOriginType =>
  fromPrismaTaskOriginType(originType);
