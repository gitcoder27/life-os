import {
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import {
  getTodayDate,
  useCreateGoalMutation,
  useGoalsWorkspaceQuery,
  useUpdateGoalMutation,
  type GoalOverviewItem,
} from "../../shared/lib/api";
import {
  PageErrorState,
  PageLoadingState,
} from "../../shared/ui/PageState";
import { readHomeDestinationState } from "../../shared/lib/homeNavigation";
import {
  GoalFormDialog,
  emptyGoalForm,
  goalToFormData,
  suggestChildHorizon,
  type GoalFormData,
} from "./GoalFormDialog";
import { GoalsModeToggle, type GoalsMode } from "./GoalsModeToggle";
import { GoalsOverviewWorkspace } from "./GoalsOverviewWorkspace";
import { GoalsPlanWorkspace } from "./GoalsPlanWorkspace";

export function GoalsPage() {
  const location = useLocation();
  const today = getTodayDate();

  // Mode state
  const [mode, setMode] = useState<GoalsMode>("overview");

  // Selection
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // Goal form (overview create/edit)
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState<GoalFormData>(emptyGoalForm());

  // Child goal form (plan mode breakdown)
  const [showChildForm, setShowChildForm] = useState(false);
  const [childFormParent, setChildFormParent] = useState<GoalOverviewItem | null>(null);
  const [childForm, setChildForm] = useState<GoalFormData>(emptyGoalForm());

  // Queries
  const workspaceQuery = useGoalsWorkspaceQuery(today);
  const createGoalMutation = useCreateGoalMutation();
  const updateGoalMutation = useUpdateGoalMutation();
  const homeDestination = readHomeDestinationState(location.state);
  const defaultDomainId =
    (workspaceQuery.data?.domains ?? []).find((domain) => !domain.isArchived && domain.systemKey === "unassigned")?.id
    ?? (workspaceQuery.data?.domains ?? []).find((domain) => !domain.isArchived)?.id
    ?? "";

  useEffect(() => {
    if (homeDestination?.kind !== "goal_plan") {
      return;
    }

    setMode(homeDestination.mode);
    setSelectedGoalId(homeDestination.goalId ?? null);

    requestAnimationFrame(() => {
      document.querySelector(".ghq-page-header")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [homeDestination, location.key]);

  if (workspaceQuery.isLoading && !workspaceQuery.data) {
    return (
      <PageLoadingState
        title="Loading Goals HQ"
        description="Pulling together your planning workspace."
      />
    );
  }

  if (workspaceQuery.isError || !workspaceQuery.data) {
    return (
      <PageErrorState
        title="Goals could not load"
        message={workspaceQuery.error instanceof Error ? workspaceQuery.error.message : undefined}
        onRetry={() => void workspaceQuery.refetch()}
      />
    );
  }

  const workspace = workspaceQuery.data;
  const { domains, horizons, goals, weekPlan, monthPlan, todayAlignment } = workspace;

  /* ── Handlers ── */

  function openCreateGoal() {
    const defaultDomain =
      domains.find((domain) => !domain.isArchived && domain.systemKey === "unassigned")
      ?? domains.find((domain) => !domain.isArchived);
    setShowChildForm(false);
    setChildFormParent(null);
    setChildForm(emptyGoalForm());
    setEditingGoalId(null);
    setGoalForm(emptyGoalForm({ domainId: defaultDomain?.id ?? "" }));
    setShowGoalForm(true);
  }

  function openEditGoal(goal: GoalOverviewItem) {
    setShowChildForm(false);
    setChildFormParent(null);
    setChildForm(emptyGoalForm());
    setEditingGoalId(goal.id);
    setGoalForm(goalToFormData(goal));
    setShowGoalForm(true);
  }

  async function handleGoalSubmit() {
    const domainId = goalForm.domainId || defaultDomainId;
    if (!goalForm.title.trim() || !domainId) return;
    if (editingGoalId) {
      await updateGoalMutation.mutateAsync({
        goalId: editingGoalId,
        title: goalForm.title.trim(),
        domainId,
        horizonId: goalForm.horizonId || null,
        parentGoalId: goalForm.parentGoalId || null,
        why: goalForm.why.trim() || null,
        targetDate: goalForm.targetDate || null,
        notes: goalForm.notes.trim() || null,
        engagementState: goalForm.engagementState || null,
        weeklyProofText: goalForm.weeklyProofText.trim() || null,
        knownObstacle: goalForm.knownObstacle.trim() || null,
        parkingRule: goalForm.parkingRule.trim() || null,
      });
    } else {
      await createGoalMutation.mutateAsync({
        title: goalForm.title.trim(),
        domainId,
        horizonId: goalForm.horizonId || null,
        parentGoalId: goalForm.parentGoalId || null,
        why: goalForm.why.trim() || null,
        targetDate: goalForm.targetDate || null,
        notes: goalForm.notes.trim() || null,
        engagementState: goalForm.engagementState || null,
        weeklyProofText: goalForm.weeklyProofText.trim() || null,
        knownObstacle: goalForm.knownObstacle.trim() || null,
        parkingRule: goalForm.parkingRule.trim() || null,
      });
    }
    setShowGoalForm(false);
    setEditingGoalId(null);
    setGoalForm(emptyGoalForm());
  }

  async function handleChildGoalSubmit() {
    const domainId = childForm.domainId || defaultDomainId;
    if (!childForm.title.trim() || !domainId) return;
    await createGoalMutation.mutateAsync({
      title: childForm.title.trim(),
      domainId,
      horizonId: childForm.horizonId || null,
      parentGoalId: childForm.parentGoalId || null,
      why: childForm.why.trim() || null,
      targetDate: childForm.targetDate || null,
      notes: childForm.notes.trim() || null,
      engagementState: childForm.engagementState || null,
      weeklyProofText: childForm.weeklyProofText.trim() || null,
      knownObstacle: childForm.knownObstacle.trim() || null,
      parkingRule: childForm.parkingRule.trim() || null,
    });
    setShowChildForm(false);
    setChildFormParent(null);
    setChildForm(emptyGoalForm());
  }

  function handleSelectGoal(goalId: string) {
    setSelectedGoalId(goalId);
    setShowChildForm(false);
  }

  function handleSwitchToPlan(goalId?: string) {
    setMode("plan");
    if (goalId) setSelectedGoalId(goalId);
  }

  function handleCreateChildFromPlan(parentGoal: GoalOverviewItem) {
    const suggestedHorizon = suggestChildHorizon(parentGoal.horizonId, horizons);
    setChildFormParent(parentGoal);
    setChildForm(emptyGoalForm({
      domainId: parentGoal.domainId,
      horizonId: suggestedHorizon,
      parentGoalId: parentGoal.id,
    }));
    setShowChildForm(true);
  }

  // Build section errors for overview planning panels
  const sectionErrors = {
    weekPlan: null as { message: string } | null,
    monthPlan: null as { message: string } | null,
  };

  return (
    <div className="ghq-page">
      {/* Page header */}
      <header className="ghq-page-header">
        <div className="ghq-page-header__left">
          <h1 className="ghq-page-header__title">Goals</h1>
          <p className="ghq-page-header__subtitle">
            {mode === "overview"
              ? "Scan your active goals and current planning."
              : "Structure your goals and connect them to weekly and monthly work."}
          </p>
        </div>
        <GoalsModeToggle mode={mode} onModeChange={setMode} />
      </header>

      {/* Mode content */}
      {mode === "overview" ? (
        <GoalsOverviewWorkspace
          goals={goals}
          domains={domains}
          horizons={horizons}
          weekPlan={weekPlan}
          monthPlan={monthPlan}
          today={today}
          selectedGoalId={selectedGoalId}
          onSelectGoal={handleSelectGoal}
          onSwitchToPlan={handleSwitchToPlan}
          onOpenCreateGoal={openCreateGoal}
          onEditGoal={openEditGoal}
          showGoalForm={showGoalForm}
          onCloseSelectedGoal={() => setSelectedGoalId(null)}
          onRefetch={() => void workspaceQuery.refetch()}
          sectionErrors={sectionErrors}
        />
      ) : (
        <GoalsPlanWorkspace
          goals={goals}
          domains={domains}
          horizons={horizons}
          weekPlan={weekPlan}
          monthPlan={monthPlan}
          todayAlignment={todayAlignment}
          selectedGoalId={selectedGoalId}
          onSelectGoal={handleSelectGoal}
          onClearSelectedGoal={() => setSelectedGoalId(null)}
          onOpenCreateGoal={openCreateGoal}
          onEditGoal={openEditGoal}
          onStartCreateChild={handleCreateChildFromPlan}
          showChildForm={showChildForm}
          childFormParent={childFormParent}
          childForm={childForm}
          onChangeChildForm={setChildForm}
          onSubmitChildForm={() => void handleChildGoalSubmit()}
          onCancelChildForm={() => {
            setShowChildForm(false);
            setChildFormParent(null);
          }}
          createIsPending={createGoalMutation.isPending}
        />
      )}

      {/* Shared goal form overlay */}
      {showGoalForm ? createPortal(
        <div className="ghq-form-overlay" role="dialog" aria-modal="true" aria-label="Goal form">
          <div className="ghq-form-overlay__backdrop" onClick={() => {
            setShowGoalForm(false);
            setEditingGoalId(null);
          }} />
          <div className="ghq-form-overlay__panel">
            <GoalFormDialog
              form={goalForm}
              editing={Boolean(editingGoalId)}
              isPending={createGoalMutation.isPending || updateGoalMutation.isPending}
              domains={domains}
              horizons={horizons}
              onChangeForm={setGoalForm}
              onSubmit={() => void handleGoalSubmit()}
              onCancel={() => {
                setShowGoalForm(false);
                setEditingGoalId(null);
              }}
            />
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
