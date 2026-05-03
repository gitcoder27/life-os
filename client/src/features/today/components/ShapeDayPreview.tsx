import type { ShapeDayPreviewResponse } from "@life-os/contracts";
import { formatTimeLabel } from "../../../shared/lib/api";

export function ShapeDayPreview({ preview }: { preview: ShapeDayPreviewResponse }) {
  return (
    <div className="shape-preview">
      <div className="shape-preview__summary">
        <span>{preview.summary}</span>
        <small>{preview.preservedBlocks.length} existing kept</small>
      </div>

      {preview.proposedBlocks.length > 0 ? (
        <PreviewGroup label="Create">
          {preview.proposedBlocks.map((block) => (
            <div className="shape-preview-row" key={block.tempId}>
              <span className="shape-preview-row__time">
                {formatTimeLabel(block.startsAt)} - {formatTimeLabel(block.endsAt)}
              </span>
              <span className="shape-preview-row__title">{block.title ?? "Focus block"}</span>
              <span className="shape-preview-row__meta">
                {block.tasks.length} task{block.tasks.length === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </PreviewGroup>
      ) : null}

      {preview.proposedAssignments.length > 0 ? (
        <PreviewGroup label="Place">
          {preview.proposedAssignments.slice(0, 6).map((assignment) => (
            <div className="shape-preview-row" key={`${assignment.blockTempId}-${assignment.taskId}`}>
              <span className="shape-preview-row__title">{assignment.taskTitle}</span>
              <span className="shape-preview-row__meta">
                {assignment.estimatedMinutes} min{assignment.assumedMinutes ? " assumed" : ""}
              </span>
            </div>
          ))}
          {preview.proposedAssignments.length > 6 ? (
            <div className="shape-preview-row shape-preview-row--muted">
              {preview.proposedAssignments.length - 6} more
            </div>
          ) : null}
        </PreviewGroup>
      ) : null}

      {preview.needsEstimateTasks.length > 0 ? (
        <PreviewGroup label="Size">
          {preview.needsEstimateTasks.slice(0, 4).map((task) => (
            <div className="shape-preview-row" key={task.taskId}>
              <span className="shape-preview-row__title">{task.title}</span>
              <span className="shape-preview-row__meta">{task.estimatedMinutes} min assumed</span>
            </div>
          ))}
        </PreviewGroup>
      ) : null}

      {preview.unplacedTasks.length > 0 ? (
        <PreviewGroup label="Leave">
          {preview.unplacedTasks.map((task) => (
            <div className="shape-preview-row" key={task.taskId}>
              <span className="shape-preview-row__title">{task.title}</span>
              <span className="shape-preview-row__meta">
                {task.reason === "no_open_window" ? "No room" : "Needs size"}
              </span>
            </div>
          ))}
        </PreviewGroup>
      ) : null}
    </div>
  );
}

function PreviewGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="shape-preview__group">
      <h4>{label}</h4>
      <div className="shape-preview__rows">{children}</div>
    </section>
  );
}
