import { useState } from "react";

import {
  getTodayDate,
  parseAmountToMinor,
  parseNumberValue,
  useAddMealMutation,
  useAddWaterMutation,
  useAddWeightMutation,
  useCreateExpenseMutation,
  useCreateTaskMutation,
  useWorkoutMutation,
} from "../../shared/lib/api";

const captureTypes = [
  "Task",
  "Expense",
  "Water",
  "Meal",
  "Workout",
  "Weight",
  "Note",
  "Reminder",
] as const;

type QuickCaptureSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function QuickCaptureSheet({
  open,
  onClose,
}: QuickCaptureSheetProps) {
  const today = getTodayDate();
  const [activeType, setActiveType] = useState<(typeof captureTypes)[number]>("Task");
  const [textValue, setTextValue] = useState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [detailValue, setDetailValue] = useState("");
  const createTaskMutation = useCreateTaskMutation(today);
  const createExpenseMutation = useCreateExpenseMutation(today);
  const addWaterMutation = useAddWaterMutation(today);
  const addMealMutation = useAddMealMutation(today);
  const workoutMutation = useWorkoutMutation(today);
  const addWeightMutation = useAddWeightMutation(today);

  function resetAndClose() {
    setTextValue("");
    setDescriptionValue("");
    setAmountValue("");
    setDetailValue("");
    onClose();
  }

  async function saveWater(amountMl: number) {
    await addWaterMutation.mutateAsync(amountMl);
    resetAndClose();
  }

  async function handleSave() {
    if (activeType === "Expense") {
      const amountMinor = parseAmountToMinor(amountValue);
      if (!amountMinor) {
        return;
      }

      await createExpenseMutation.mutateAsync({
        spentOn: today,
        amountMinor,
        description: descriptionValue || "Quick expense",
        source: "quick_capture",
      });
      resetAndClose();
      return;
    }

    if (activeType === "Task" || activeType === "Note" || activeType === "Reminder") {
      const title = textValue.trim();
      if (!title) {
        return;
      }

      await createTaskMutation.mutateAsync({
        title: title.split("\n")[0],
        notes: title,
        scheduledForDate: today,
        originType: "quick_capture",
      });
      resetAndClose();
      return;
    }

    if (activeType === "Meal") {
      if (!detailValue.trim()) {
        return;
      }

      await addMealMutation.mutateAsync({
        description: detailValue.trim(),
        loggingQuality: "partial",
      });
      resetAndClose();
      return;
    }

    if (activeType === "Workout") {
      if (!detailValue.trim()) {
        return;
      }

      await workoutMutation.mutateAsync({
        planType: "workout",
        plannedLabel: detailValue.trim(),
        actualStatus: "completed",
      });
      resetAndClose();
      return;
    }

    if (activeType === "Weight") {
      const weightValue = parseNumberValue(detailValue);
      if (!weightValue) {
        return;
      }

      await addWeightMutation.mutateAsync({
        weightValue,
        measuredOn: today,
      });
      resetAndClose();
    }
  }

  return (
    <div
      aria-hidden={!open}
      className={`capture-sheet${open ? " capture-sheet--open" : ""}`}
    >
      <div
        className="capture-sheet__backdrop"
        onClick={onClose}
      />
      <section className="capture-sheet__panel">
        <div className="capture-sheet__header">
          <div>
            <p className="page-eyebrow">Quick entry</p>
            <h3 className="capture-sheet__title">Capture</h3>
          </div>
          <button
            className="button button--ghost button--small"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="capture-grid">
          {captureTypes.map((item) => (
            <button
              key={item}
              className={`capture-chip${item === activeType ? " capture-chip--active" : ""}`}
              type="button"
              onClick={() => setActiveType(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="stack-form">
          {activeType === "Expense" && (
            <>
              <label className="field">
                <span>Amount</span>
                <input
                  placeholder="$0.00"
                  type="text"
                  inputMode="decimal"
                  value={amountValue}
                  onChange={(event) => setAmountValue(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Description</span>
                <input
                  placeholder="What was it for?"
                  type="text"
                  value={descriptionValue}
                  onChange={(event) => setDescriptionValue(event.target.value)}
                />
              </label>
            </>
          )}
          {activeType === "Water" && (
            <div className="button-row">
              <button className="button button--ghost" type="button" onClick={() => void saveWater(250)}>+250ml</button>
              <button className="button button--ghost" type="button" onClick={() => void saveWater(500)}>+500ml</button>
              <button className="button button--primary" type="button" onClick={() => void saveWater(1000)}>+1L</button>
            </div>
          )}
          {(activeType === "Task" || activeType === "Note" || activeType === "Reminder") && (
            <label className="field">
              <span>{activeType}</span>
              <textarea
                placeholder={`Quick ${activeType.toLowerCase()}...`}
                rows={3}
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
              />
            </label>
          )}
          {(activeType === "Meal" || activeType === "Workout" || activeType === "Weight") && (
            <label className="field">
              <span>{activeType} details</span>
              <input
                placeholder={`Log ${activeType.toLowerCase()}...`}
                type="text"
                value={detailValue}
                onChange={(event) => setDetailValue(event.target.value)}
              />
            </label>
          )}
          <button
            className="button button--primary"
            type="button"
            style={{ width: "100%" }}
            onClick={() => void handleSave()}
            disabled={activeType === "Water"}
          >
            Save {activeType.toLowerCase()}
          </button>
        </div>
      </section>
    </div>
  );
}
