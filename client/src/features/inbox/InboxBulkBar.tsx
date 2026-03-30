import { useState } from "react";

import { SmartDatePicker } from "../../shared/ui/SmartDatePicker";

type InboxBulkBarProps = {
  selectedCount: number;
  totalCount: number;
  today: string;
  isMutating: boolean;
  onDoToday: () => void;
  onSchedule: (date: string) => void;
  onArchive: () => void;
  onSelectAll: () => void;
  onClear: () => void;
};

export function InboxBulkBar({
  selectedCount,
  totalCount,
  today,
  isMutating,
  onDoToday,
  onSchedule,
  onArchive,
  onSelectAll,
  onClear,
}: InboxBulkBarProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  function handleDateSelect(date: string) {
    setShowDatePicker(false);
    onSchedule(date);
  }

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="inbox-bulk-bar">
      <span className="inbox-bulk-bar__count">
        {selectedCount} selected
      </span>
      <button
        className="inbox-bulk-bar__select-all"
        type="button"
        onClick={allSelected ? onClear : onSelectAll}
      >
        {allSelected ? "Deselect all" : "Select all"}
      </button>
      <span className="inbox-bulk-bar__divider" />
      <div className="inbox-bulk-bar__actions">
        <button
          className="button button--primary button--small"
          type="button"
          onClick={onDoToday}
          disabled={isMutating}
        >
          Do today
        </button>
        <span style={{ position: "relative" }}>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            disabled={isMutating}
          >
            Schedule
          </button>
          {showDatePicker && (
            <div
              style={{ position: "absolute", bottom: "100%", right: 0, zIndex: 31, marginBottom: "0.5rem" }}
              onClick={(e) => e.stopPropagation()}
            >
              <SmartDatePicker
                value=""
                onChange={handleDateSelect}
                minDate={today}
              />
            </div>
          )}
        </span>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={onArchive}
          disabled={isMutating}
        >
          Archive
        </button>
      </div>
      <button
        className="inbox-bulk-bar__dismiss"
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
      >
        ✕
      </button>
    </div>
  );
}
