const WORKBENCH_LAYOUT_STORAGE_KEY = "life-os:today-workbench-layout";
const WORKBENCH_LAYOUT_STORAGE_VERSION = 1;

export const DEFAULT_WORKBENCH_RAIL_WIDTH = 384;
export const MIN_WORKBENCH_RAIL_WIDTH = 320;
export const MAX_WORKBENCH_RAIL_WIDTH = 544;
export const WORKBENCH_RAIL_WIDTH_STEP = 16;

type StoredWorkbenchLayout = {
  version: number;
  railWidthPx: number;
};

export function clampWorkbenchRailWidth(value: number) {
  return Math.min(
    Math.max(Math.round(value), MIN_WORKBENCH_RAIL_WIDTH),
    MAX_WORKBENCH_RAIL_WIDTH,
  );
}

export function readStoredWorkbenchRailWidth() {
  try {
    const rawValue = localStorage.getItem(WORKBENCH_LAYOUT_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_WORKBENCH_RAIL_WIDTH;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredWorkbenchLayout>;
    if (
      parsed.version !== WORKBENCH_LAYOUT_STORAGE_VERSION ||
      typeof parsed.railWidthPx !== "number" ||
      !Number.isFinite(parsed.railWidthPx)
    ) {
      localStorage.removeItem(WORKBENCH_LAYOUT_STORAGE_KEY);
      return DEFAULT_WORKBENCH_RAIL_WIDTH;
    }

    return clampWorkbenchRailWidth(parsed.railWidthPx);
  } catch {
    return DEFAULT_WORKBENCH_RAIL_WIDTH;
  }
}

export function writeStoredWorkbenchRailWidth(railWidthPx: number) {
  try {
    const payload: StoredWorkbenchLayout = {
      version: WORKBENCH_LAYOUT_STORAGE_VERSION,
      railWidthPx: clampWorkbenchRailWidth(railWidthPx),
    };
    localStorage.setItem(WORKBENCH_LAYOUT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return;
  }
}

export function clearStoredWorkbenchRailWidth() {
  try {
    localStorage.removeItem(WORKBENCH_LAYOUT_STORAGE_KEY);
  } catch {
    return;
  }
}
