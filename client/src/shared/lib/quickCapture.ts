export type QuickCaptureKind = "note" | "reminder";

const QUICK_CAPTURE_MARKER = "life_os_capture";
const QUICK_CAPTURE_VERSION = 1;

export type QuickCaptureMetadata = {
  marker: string;
  v: number;
  kind: QuickCaptureKind;
  text: string;
  reminderDate?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringifyQuickCaptureNotes(payload: { kind: QuickCaptureKind; text: string; reminderDate?: string }) {
  return JSON.stringify({
    marker: QUICK_CAPTURE_MARKER,
    v: QUICK_CAPTURE_VERSION,
    kind: payload.kind,
    text: payload.text.trim(),
    reminderDate: payload.reminderDate,
  });
}

export function parseQuickCaptureNotes(notes: string | null): QuickCaptureMetadata | null {
  if (!notes) {
    return null;
  }

  try {
    const parsed = JSON.parse(notes);

    if (
      !isObject(parsed) ||
      parsed.marker !== QUICK_CAPTURE_MARKER ||
      parsed.v !== QUICK_CAPTURE_VERSION ||
      (parsed.kind !== "note" && parsed.kind !== "reminder") ||
      typeof parsed.text !== "string"
    ) {
      return null;
    }

    return {
      marker: parsed.marker as string,
      v: parsed.v,
      kind: parsed.kind as QuickCaptureKind,
      text: parsed.text,
      reminderDate: typeof parsed.reminderDate === "string" ? parsed.reminderDate : undefined,
    };
  } catch {
    return null;
  }
}

export function getQuickCaptureDisplayText(notes: string | null, fallback = ""): string {
  const parsed = parseQuickCaptureNotes(notes);

  if (!parsed) {
    return fallback;
  }

  const text = parsed.text.trim();

  if (parsed.kind === "note") {
    return text || fallback;
  }

  return `Reminder${parsed.reminderDate ? ` for ${parsed.reminderDate}` : ""}: ${text || "Reminder"}` || fallback;
}

export function isQuickCaptureReminder(notes: string | null): boolean {
  const parsed = parseQuickCaptureNotes(notes);
  return parsed?.kind === "reminder";
}

export function isQuickCaptureNote(notes: string | null): boolean {
  const parsed = parseQuickCaptureNotes(notes);
  return parsed?.kind === "note";
}
