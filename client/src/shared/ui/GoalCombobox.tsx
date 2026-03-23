import { useEffect, useMemo, useRef, useState } from "react";

type GoalOption = {
  id: string;
  title: string;
  domain: string;
};

type GoalComboboxProps = {
  goals: GoalOption[];
  value: string;
  onChange: (goalId: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

function getDomainLabel(domain: string) {
  switch (domain) {
    case "health":
      return "🏥";
    case "money":
      return "💰";
    case "work_growth":
      return "📈";
    case "home_admin":
      return "🏠";
    case "discipline":
      return "🎯";
    default:
      return "📌";
  }
}

export function GoalCombobox({
  goals,
  value,
  onChange,
  disabled,
  placeholder = "Search goals…",
}: GoalComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [flipUp, setFlipUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedGoal = goals.find((g) => g.id === value);

  const filteredGoals = useMemo(() => {
    if (!search.trim()) return goals;
    const term = search.toLowerCase();
    return goals.filter((g) => g.title.toLowerCase().includes(term));
  }, [goals, search]);

  // Build the full options list: "No goal" first, then filtered goals
  const options = useMemo(() => {
    const items: Array<{ id: string; title: string; domain: string; isNoGoal: boolean }> = [
      { id: "", title: "No goal", domain: "", isNoGoal: true },
      ...filteredGoals.map((g) => ({ ...g, isNoGoal: false })),
    ];
    return items;
  }, [filteredGoals]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [search, open]);

  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setFlipUp(spaceBelow < 260);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function selectOption(goalId: string) {
    onChange(goalId);
    setSearch("");
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (options[highlightIndex]) {
          selectOption(options[highlightIndex].id);
        }
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        setSearch("");
        break;
    }
  }

  function handleTriggerClick() {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="goal-combobox" ref={containerRef}>
      {open ? (
        <div className="goal-combobox__input-wrap">
          <input
            ref={inputRef}
            className="goal-combobox__input"
            type="text"
            value={search}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="goal-combobox-listbox"
          />
        </div>
      ) : (
        <button
          className="goal-combobox__trigger"
          type="button"
          disabled={disabled}
          onClick={handleTriggerClick}
        >
          {selectedGoal ? (
            <>
              <span className="goal-combobox__domain">{getDomainLabel(selectedGoal.domain)}</span>
              <span className="goal-combobox__selected-title">{selectedGoal.title}</span>
            </>
          ) : (
            <span className="goal-combobox__placeholder">
              {value === "" ? "No goal" : "Select goal…"}
            </span>
          )}
          <span className="goal-combobox__caret">▼</span>
        </button>
      )}

      {open ? (
        <ul
          className={`goal-combobox__listbox${flipUp ? " goal-combobox__listbox--flip" : ""}`}
          id="goal-combobox-listbox"
          role="listbox"
        >
          {options.length === 0 ? (
            <li className="goal-combobox__empty">No matching goals</li>
          ) : (
            options.map((opt, i) => (
              <li
                key={opt.id || "__none__"}
                className={`goal-combobox__option${i === highlightIndex ? " goal-combobox__option--highlight" : ""}${opt.id === value ? " goal-combobox__option--selected" : ""}`}
                role="option"
                aria-selected={opt.id === value}
                onMouseEnter={() => setHighlightIndex(i)}
                onClick={() => selectOption(opt.id)}
              >
                {opt.isNoGoal ? (
                  <span className="goal-combobox__no-goal">No goal</span>
                ) : (
                  <>
                    <span className="goal-combobox__domain">{getDomainLabel(opt.domain)}</span>
                    <span className="goal-combobox__option-title">{opt.title}</span>
                  </>
                )}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
