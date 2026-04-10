import { useState } from "react";

import type { NotificationItem, SnoozePreset } from "../../shared/lib/api";
import {
  CATEGORY_LABELS,
  formatNotificationTime,
  isTonightAvailable,
  resolveActionLabel,
  resolveNotificationTarget,
} from "./notification-center-model";

type SnoozeMenuProps = {
  isPending: boolean;
  notificationId: string;
  onSnooze: (notificationId: string, preset: SnoozePreset) => void;
};

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M3.5 8.5 6.5 11.5 12.5 4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DismissIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M4 4 12 12M12 4 4 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <circle
      cx="8"
      cy="8"
      r="5.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <path
      d="M8 5.1v3.2l2.2 1.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
        className="notif-utility-btn"
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        <span className="notif-utility-btn__icon"><ClockIcon /></span>
        Later
      </button>
    );
  }

  return (
    <div className="notif-snooze-menu" role="group" aria-label="Snooze notification">
      <span className="notif-snooze-menu__label">Later</span>
      <button
        className="notif-snooze-menu__option"
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
          className="notif-snooze-menu__option"
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
        className="notif-snooze-menu__option"
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
        className="notif-snooze-menu__cancel"
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cancel snooze"
      >
        <DismissIcon />
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
  const target = resolveNotificationTarget(item);
  const isUnread = !item.read;
  const actionLabel = resolveActionLabel(item.entityType);

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
          <div className="notif-action-card__meta">
            <span className={`notif-category-badge notif-category-badge--${item.notificationType}`}>
              {CATEGORY_LABELS[item.notificationType]}
            </span>
            {isUnread ? <span className="notif-action-card__status">New</span> : null}
          </div>
          <span className="notif-action-card__time">{formatNotificationTime(item.createdAt)}</span>
        </div>

        <div className="notif-action-card__title">{item.title}</div>
        <div className="notif-action-card__text">{item.body}</div>

        <div className="notif-action-card__footer">
          {target ? (
            <button
              className="notif-action-card__primary"
              type="button"
              onClick={onOpen}
            >
              {actionLabel}
            </button>
          ) : null}
          <div className="notif-action-card__actions">
            {isUnread ? (
              <button
                className="notif-utility-btn"
                type="button"
                onClick={onMarkRead}
                disabled={isMarkingRead}
                aria-label="Mark notification as read"
              >
                <span className="notif-utility-btn__icon"><CheckIcon /></span>
                Read
              </button>
            ) : null}
            <SnoozeMenu
              notificationId={item.id}
              onSnooze={onSnooze}
              isPending={isSnoozing}
            />
            <button
              className="notif-utility-btn notif-utility-btn--danger"
              type="button"
              onClick={onDismiss}
              disabled={isDismissing}
              aria-label="Dismiss notification"
            >
              <span className="notif-utility-btn__icon"><DismissIcon /></span>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
