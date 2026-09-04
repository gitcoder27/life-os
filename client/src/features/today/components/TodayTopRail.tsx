import type { ComponentProps, RefCallback } from "react";

import { InlineErrorState } from "../../../shared/ui/PageState";
import { CommandBar } from "./CommandBar";

type TodayTopRailProps = {
  allErrors: string | null;
  commandBarProps: ComponentProps<typeof CommandBar>;
  onRetryAll: () => void;
  onRetryScore: () => void;
  scoreError: string | null | undefined;
  topRailRef: RefCallback<HTMLDivElement>;
};

export function TodayTopRail({
  allErrors,
  commandBarProps,
  onRetryAll,
  onRetryScore,
  scoreError,
  topRailRef,
}: TodayTopRailProps) {
  return (
    <div className="today-top-rail" ref={topRailRef}>
      <CommandBar {...commandBarProps} />

      {allErrors ? (
        <InlineErrorState message={allErrors} onRetry={onRetryAll} />
      ) : null}
      {scoreError ? (
        <InlineErrorState
          message={scoreError}
          onRetry={onRetryScore}
        />
      ) : null}
    </div>
  );
}
