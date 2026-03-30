export function InboxEmptyState() {
  return (
    <div className="inbox-zero">
      <div className="inbox-zero__icon">✦</div>
      <h2 className="inbox-zero__title">All clear.</h2>
      <p className="inbox-zero__subtitle">
        Nothing to triage. Captures will appear here when you add them.
      </p>
    </div>
  );
}
