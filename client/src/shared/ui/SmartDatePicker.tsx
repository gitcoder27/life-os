import { useEffect, useRef, useState } from "react";

import { toIsoDate } from "../lib/api";

type SmartDatePickerProps = {
  value: string;
  onChange: (isoDate: string) => void;
  minDate?: string;
  disabled?: boolean;
};

type SmartOption = {
  label: string;
  getDate: () => string;
};

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function getNextDayOfWeek(isoDate: string, dayOfWeek: number) {
  const date = new Date(`${isoDate}T12:00:00`);
  const current = date.getDay();
  const daysUntil = (dayOfWeek - current + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntil);
  return toIsoDate(date);
}

function getSmartOptions(today: string): SmartOption[] {
  return [
    { label: "Tomorrow", getDate: () => addDays(today, 1) },
    { label: "Later this week", getDate: () => getNextDayOfWeek(today, 5) },
    { label: "Next Monday", getDate: () => getNextDayOfWeek(today, 1) },
    { label: "Someday", getDate: () => addDays(today, 30) },
  ];
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days: Array<{ date: Date; iso: string; inMonth: boolean }> = [];

  // Fill leading blanks from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, iso: toIsoDate(d), inMonth: false });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, iso: toIsoDate(d), inMonth: true });
  }

  // Fill trailing blanks to complete the last week
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, iso: toIsoDate(d), inMonth: false });
    }
  }

  return days;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatDisplayDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function SmartDatePicker({ value, onChange, minDate, disabled }: SmartDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = toIsoDate(new Date());
  const smartOptions = getSmartOptions(today);

  // Calendar state — derive initial month from the current value
  const valueParts = value ? value.split("-").map(Number) : today.split("-").map(Number);
  const [viewYear, setViewYear] = useState(valueParts[0]);
  const [viewMonth, setViewMonth] = useState(valueParts[1] - 1);

  const calendarDays = getCalendarDays(viewYear, viewMonth);

  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setFlipUp(spaceBelow < 380);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function selectDate(isoDate: string) {
    onChange(isoDate);
    setOpen(false);
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function isBeforeMin(iso: string) {
    return minDate ? iso < minDate : false;
  }

  return (
    <div className="smart-date-picker" ref={containerRef}>
      <button
        className="smart-date-picker__trigger"
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="smart-date-picker__icon">📅</span>
        <span className="smart-date-picker__value">
          {value ? formatDisplayDate(value) : "Pick a date"}
        </span>
        <span className="smart-date-picker__caret">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className={`smart-date-picker__popover${flipUp ? " smart-date-picker__popover--flip" : ""}`} role="dialog" aria-label="Schedule date">
          <div className="smart-date-picker__shortcuts">
            {smartOptions.map((opt) => {
              const optDate = opt.getDate();
              const isDisabled = isBeforeMin(optDate);
              return (
                <button
                  key={opt.label}
                  className={`smart-date-picker__shortcut${value === optDate ? " smart-date-picker__shortcut--active" : ""}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => selectDate(optDate)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="smart-date-picker__calendar">
            <div className="smart-date-picker__cal-header">
              <button
                className="smart-date-picker__cal-nav"
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="smart-date-picker__cal-title">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                className="smart-date-picker__cal-nav"
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <div className="smart-date-picker__cal-grid">
              {DAY_HEADERS.map((d) => (
                <span key={d} className="smart-date-picker__cal-day-header">{d}</span>
              ))}
              {calendarDays.map((day, i) => {
                const isSelected = day.iso === value;
                const isToday = day.iso === today;
                const isDisabled = !day.inMonth || isBeforeMin(day.iso);
                let cls = "smart-date-picker__cal-day";
                if (!day.inMonth) cls += " smart-date-picker__cal-day--outside";
                if (isSelected) cls += " smart-date-picker__cal-day--selected";
                if (isToday) cls += " smart-date-picker__cal-day--today";
                if (isDisabled) cls += " smart-date-picker__cal-day--disabled";

                return (
                  <button
                    key={i}
                    className={cls}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectDate(day.iso)}
                    aria-label={day.iso}
                  >
                    {day.date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
