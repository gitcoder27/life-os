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

export function LoadingIndicator({
  label = "Loading",
}: {
  label?: string;
}) {
  return (
    <div className="state-loader" aria-hidden="true">
      <span className="state-loader__ring state-loader__ring--outer" />
      <span className="state-loader__ring state-loader__ring--inner" />
      <span className="state-loader__core" />
      <span className="state-loader__dot state-loader__dot--amber" />
      <span className="state-loader__dot state-loader__dot--green" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageLoadingState({
  eyebrow = "Loading",
  title,
  description,
}: PageLoadingStateProps) {
  return (
    <section
      className="page-state page-state--loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingIndicator label={eyebrow} />
      <div className="page-state__content">
        <span className="page-eyebrow">{eyebrow}</span>
        <h1 className="page-state__title">{title}</h1>
        <p className="page-state__copy">{description}</p>
      </div>
      <div className="page-state__progress" aria-hidden="true">
        <span className="page-state__progress-track" />
        <span className="page-state__progress-track page-state__progress-track--short" />
      </div>
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
