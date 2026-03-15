type PageLoadingStateProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

type PageErrorStateProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
};

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

type InlineErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function PageLoadingState({
  eyebrow = "Loading",
  title,
  description,
}: PageLoadingStateProps) {
  return (
    <section className="page-state">
      <span className="page-eyebrow">{eyebrow}</span>
      <h1 className="page-state__title">{title}</h1>
      <p className="page-state__copy">{description}</p>
    </section>
  );
}

export function PageErrorState({
  title,
  message = "This page could not load right now.",
  onRetry,
}: PageErrorStateProps) {
  return (
    <section className="page-state page-state--error">
      <span className="page-eyebrow">Connection issue</span>
      <h1 className="page-state__title">{title}</h1>
      <p className="page-state__copy">{message}</p>
      {onRetry ? (
        <button className="button button--primary" onClick={onRetry} type="button">
          Retry
        </button>
      ) : null}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__copy">{description}</p>
      {actionLabel && onAction ? (
        <button className="button button--ghost button--small" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function InlineErrorState({
  message,
  onRetry,
}: InlineErrorStateProps) {
  return (
    <div className="inline-state inline-state--error">
      <span>{message}</span>
      {onRetry ? (
        <button className="button button--ghost button--small" onClick={onRetry} type="button">
          Retry
        </button>
      ) : null}
    </div>
  );
}
