import { useState } from "react";

import {
  getTodayDate,
  useApplyTaskTemplateMutation,
  useCreateTaskTemplateMutation,
  useTaskTemplatesQuery,
  useUpdateTaskTemplateMutation,
  type TaskTemplate,
} from "../../shared/lib/api";
import { EmptyState, InlineErrorState } from "../../shared/ui/PageState";
import { taskTextAutocompleteProps } from "../../shared/ui/task-autocomplete";

type TemplateFormState = {
  name: string;
  description: string;
  taskLines: string;
};

const emptyTemplateForm: TemplateFormState = {
  name: "",
  description: "",
  taskLines: "",
};

function buildTemplateTasks(taskLines: string) {
  return taskLines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((title) => ({ title }));
}

function formatLastAppliedAt(value: string | null) {
  if (!value) {
    return "Never used";
  }

  return `Last used ${new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function templateTaskLines(template: TaskTemplate) {
  return template.tasks.map((task) => task.title).join("\n");
}

export function WorkflowTemplatesSection() {
  const today = getTodayDate();
  const taskTemplatesQuery = useTaskTemplatesQuery();
  const createTaskTemplateMutation = useCreateTaskTemplateMutation();
  const updateTaskTemplateMutation = useUpdateTaskTemplateMutation();
  const applyTaskTemplateMutation = useApplyTaskTemplateMutation(today);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);

  const templates = taskTemplatesQuery.data?.taskTemplates ?? [];
  const formTasks = buildTemplateTasks(form.taskLines);
  const isSaving = createTaskTemplateMutation.isPending || updateTaskTemplateMutation.isPending;
  const isMutating = isSaving || applyTaskTemplateMutation.isPending;
  const mutationError =
    createTaskTemplateMutation.error instanceof Error
      ? createTaskTemplateMutation.error.message
      : updateTaskTemplateMutation.error instanceof Error
        ? updateTaskTemplateMutation.error.message
        : applyTaskTemplateMutation.error instanceof Error
          ? applyTaskTemplateMutation.error.message
          : null;

  function openCreate() {
    setEditingTemplateId(null);
    setForm(emptyTemplateForm);
    setShowForm(true);
  }

  function openEdit(template: TaskTemplate) {
    setEditingTemplateId(template.id);
    setForm({
      name: template.name,
      description: template.description ?? "",
      taskLines: templateTaskLines(template),
    });
    setShowForm(true);
  }

  function handleCancel() {
    setEditingTemplateId(null);
    setForm(emptyTemplateForm);
    setShowForm(false);
  }

  async function handleSubmit() {
    const name = form.name.trim();
    const description = form.description.trim();
    const tasks = buildTemplateTasks(form.taskLines);

    if (!name || tasks.length === 0) {
      return;
    }

    if (editingTemplateId) {
      await updateTaskTemplateMutation.mutateAsync({
        taskTemplateId: editingTemplateId,
        name,
        description: description || null,
        tasks,
      });
    } else {
      await createTaskTemplateMutation.mutateAsync({
        name,
        description: description || null,
        tasks,
      });
    }

    handleCancel();
  }

  async function handleArchive(taskTemplateId: string) {
    await updateTaskTemplateMutation.mutateAsync({
      taskTemplateId,
      archived: true,
    });

    if (editingTemplateId === taskTemplateId) {
      handleCancel();
    }
  }

  async function handleApply(taskTemplateId: string) {
    const response = await applyTaskTemplateMutation.mutateAsync(taskTemplateId);
    setApplyFeedback(`Added ${response.tasks.length} task${response.tasks.length === 1 ? "" : "s"} to Inbox.`);
  }

  return (
    <div>
      {mutationError ? (
        <InlineErrorState
          message={mutationError}
          onRetry={() => void taskTemplatesQuery.refetch()}
        />
      ) : null}
      {applyFeedback ? <p className="workflow-template-feedback">{applyFeedback}</p> : null}

      {showForm ? (
        <div className="stack-form workflow-template-form">
          <label className="field">
            <span>Template name</span>
            <input
              type="text"
              value={form.name}
              placeholder="Travel prep"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>Description (optional)</span>
            <input
              type="text"
              value={form.description}
              placeholder="Standard checklist before a trip"
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>

          <label className="field">
            <span>Tasks</span>
            <textarea
              {...taskTextAutocompleteProps}
              rows={8}
              value={form.taskLines}
              placeholder={"Check passport\nPack chargers\nPause subscriptions"}
              onChange={(event) => setForm((current) => ({ ...current, taskLines: event.target.value }))}
            />
          </label>

          <p className="workflow-template-help">Enter one task per line. Blank lines are ignored.</p>

          <div className="button-row button-row--tight">
            <button
              className="button button--primary button--small"
              type="button"
              disabled={!form.name.trim() || formTasks.length === 0 || isSaving}
              onClick={() => void handleSubmit()}
            >
              {isSaving ? "Saving…" : editingTemplateId ? "Update" : "Create"}
            </button>
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {taskTemplatesQuery.isLoading && !taskTemplatesQuery.data ? (
        <p className="workflow-template-help">Loading templates…</p>
      ) : templates.length > 0 ? (
        <div className="template-grid">
          {templates.map((template) => (
            <div key={template.id} className="template-card">
              <div className="template-card__name">{template.name}</div>
              <div className="template-card__slot">
                {template.tasks.length} task{template.tasks.length === 1 ? "" : "s"}
              </div>
              {template.description ? (
                <div className="template-card__desc">{template.description}</div>
              ) : null}
              <div className="workflow-template-last-used">{formatLastAppliedAt(template.lastAppliedAt)}</div>
              <div className="workflow-template-actions" style={{ marginTop: "0.5rem" }}>
                <button
                  className="button button--primary button--small"
                  type="button"
                  disabled={isMutating}
                  onClick={() => void handleApply(template.id)}
                >
                  Apply
                </button>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={isMutating}
                  onClick={() => openEdit(template)}
                >
                  Edit
                </button>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  disabled={isMutating}
                  onClick={() => void handleArchive(template.id)}
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No workflow templates yet"
          description="Save a reusable checklist once, then drop the full task bundle into Inbox with one click."
        />
      )}

      {!showForm ? (
        <button
          className="button button--ghost button--small"
          type="button"
          style={{ marginTop: "0.75rem" }}
          onClick={openCreate}
        >
          + New template
        </button>
      ) : null}
    </div>
  );
}
