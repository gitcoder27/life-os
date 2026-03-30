import { useState } from "react";

import type { NotificationItem, SnoozePreset } from "../../shared/lib/api";
import {
  CATEGORY_LABELS,
  formatNotificationTime,
  isTonightAvailable,
  resolveActionLabel,
  resolveEntityRoute,
} from "./notification-center-model";

type SnoozeMenuProps = {
  isPending: boolean;
  notificationId: string;
  onSnooze: (notificationId: string, preset: SnoozePreset) => void;
};

const SnoozeMenu = ({
  isPending,
  notificationId,
  onSnooze,
}: SnoozeMenuProps) => {
  const [open, setOpen] = useState(false);
  const tonightAvailable = isTonightAvailable();

  if (!open) {
    return (
      <button
        className="button button--ghost button--small"
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        Snooze
      </button>
    );
  }

  return (
    <div className="notif-snooze-group">
      <button
        className="button button--ghost button--small notif-snooze-btn"
        type="button"
        disabled={isPending}
        onClick={() => {
          onSnooze(notificationId, "one_hour");
          setOpen(false);
        }}
      >
        1h
      </button>
      {tonightAvailable ? (
        <button
          className="button button--ghost button--small notif-snooze-btn"
          type="button"
          disabled={isPending}
          onClick={() => {
            onSnooze(notificationId, "tonight");
            setOpen(false);
          }}
        >
          Tonight
        </button>
      ) : null}
      <button
        className="button button--ghost button--small notif-snooze-btn"
        type="button"
        disabled={isPending}
        onClick={() => {
          onSnooze(notificationId, "tomorrow");
          setOpen(false);
        }}
      >
        Tomorrow
      </button>
      <button
        className="button button--ghost button--small"
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cancel snooze"
      >
        ✕
      </button>
    </div>
  );
};

type NotificationActionCardProps = {
  isDismissing: boolean;
  isMarkingRead: boolean;
  isSnoozing: boolean;
  item: NotificationItem;
  onDismiss: () => void;
  onMarkRead: () => void;
  onOpen: () => void;
  onSnooze: (notificationId: string, preset: SnoozePreset) => void;
};

export const NotificationActionCard = ({
  isDismissing,
  isMarkingRead,
  isSnoozing,
  item,
  onDismiss,
  onMarkRead,
  onOpen,
  onSnooze,
}: NotificationActionCardProps) => {
  const route = resolveEntityRoute(item.entityType, item.entityId);
  const isUnread = !item.read;

  return (
    <div
      className={[
        "notif-action-card",
        isUnread ? "notif-action-card--unread" : "",
        `notif-action-card--${item.severity}`,
      ].filter(Boolean).join(" ")}
    >
      <div className="notif-action-card__rail">
        <span className="notif-action-card__dot" />
      </div>

      <div className="notif-action-card__body">
        <div className="notif-action-card__top">
          <span className={`notif-category-badge notif-category-badge--${item.notificationType}`}>
            {CATEGORY_LABELS[item.notificationType]}
          </span>
          <span className="notif-action-card__title">{item.title}</span>
          <span className="notif-action-card__time">{formatNotificationTime(item.createdAt)}</span>
        </div>

        <div className="notif-action-card__text">{item.body}</div>

        <div className="notif-action-card__actions">
          {route ? (
            <button
              className="button button--primary button--small"
              type="button"
              onClick={onOpen}
            >
              {resolveActionLabel(item.entityType)}
            </button>
          ) : null}
          {isUnread ? (
            <button
              className="button button--ghost button--small"
              type="button"
              onClick={onMarkRead}
              disabled={isMarkingRead}
            >
              Mark read
            </button>
          ) : null}
          <SnoozeMenu
            notificationId={item.id}
            onSnooze={onSnooze}
            isPending={isSnoozing}
          />
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={onDismiss}
            disabled={isDismissing}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
