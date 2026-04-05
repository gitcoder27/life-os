import {
  useEffect,
  useState,
} from "react";
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
    const defaultDomain = domains.find((d) => !d.isArchived);
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
    if (!goalForm.title.trim() || !goalForm.domainId) return;
    if (editingGoalId) {
      await updateGoalMutation.mutateAsync({
        goalId: editingGoalId,
        title: goalForm.title.trim(),
        domainId: goalForm.domainId,
        horizonId: goalForm.horizonId || null,
        parentGoalId: goalForm.parentGoalId || null,
        why: goalForm.why.trim() || null,
        targetDate: goalForm.targetDate || null,
        notes: goalForm.notes.trim() || null,
      });
    } else {
      await createGoalMutation.mutateAsync({
        title: goalForm.title.trim(),
        domainId: goalForm.domainId,
        horizonId: goalForm.horizonId || null,
        parentGoalId: goalForm.parentGoalId || null,
        why: goalForm.why.trim() || null,
        targetDate: goalForm.targetDate || null,
        notes: goalForm.notes.trim() || null,
      });
    }
    setShowGoalForm(false);
    setEditingGoalId(null);
    setGoalForm(emptyGoalForm());
  }

  async function handleChildGoalSubmit() {
    if (!childForm.title.trim() || !childForm.domainId) return;
    await createGoalMutation.mutateAsync({
      title: childForm.title.trim(),
      domainId: childForm.domainId,
      horizonId: childForm.horizonId || null,
      parentGoalId: childForm.parentGoalId || null,
      why: childForm.why.trim() || null,
      targetDate: childForm.targetDate || null,
      notes: childForm.notes.trim() || null,
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
      {showGoalForm && (
        <div className="ghq-form-overlay">
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
        </div>
      )}
    </div>
  );
}
