export const parseAmountToMinor = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
};

export const parseNumberValue = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const splitEntries = (value: string) =>
  value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);

export const toPriorityInputs = (values: string[]) =>
  values
    .filter(Boolean)
    .slice(0, 3)
    .map((title, index) => ({
      slot: ([1, 2, 3] as const)[index],
      title,
    }));
