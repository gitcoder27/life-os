import { EmptyState } from "../../shared/ui/PageState";

export function InboxEmptyState() {
  return (
    <div className="inbox-zero">
      <EmptyState
        title="All clear."
        description="Nothing to triage. Captures will appear here when you add them."
      />
    </div>
  );
}
