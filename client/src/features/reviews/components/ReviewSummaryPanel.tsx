import type { ReactNode } from "react";

import { InlineErrorState } from "../../../shared/ui/PageState";
import { SectionCard } from "../../../shared/ui/SectionCard";

type ReviewSummaryPanelProps = {
  title: string;
  subtitle: string;
  items: string[];
  retryMessage?: string | null;
  onRetry?: (() => void) | null;
  footer?: ReactNode;
};

export const ReviewSummaryPanel = ({
  title,
  subtitle,
  items,
  retryMessage,
  onRetry,
  footer,
}: ReviewSummaryPanelProps) => (
  <SectionCard title={title} subtitle={subtitle}>
    {retryMessage && onRetry ? (
      <InlineErrorState message={retryMessage} onRetry={onRetry} />
    ) : (
      <>
        <ul className="list">
          {items.map((item) => (
            <li key={item}>
              <span>{item}</span>
              <span className="tag tag--neutral">auto</span>
            </li>
          ))}
        </ul>
        {footer}
      </>
    )}
  </SectionCard>
);
