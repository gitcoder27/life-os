import type {
  AbortFocusSessionRequest,
  CaptureFocusDistractionRequest,
  CompleteFocusSessionRequest,
  CreateFocusSessionRequest,
  FocusSessionDepth,
  FocusSessionExitReason,
  FocusSessionTaskOutcome,
} from "@life-os/contracts";
import { z } from "zod";

const focusSessionDepthSchema = z.enum(["deep", "shallow"]) as z.ZodType<FocusSessionDepth>;
const focusSessionExitReasonSchema = z.enum([
  "interrupted",
  "low_energy",
  "unclear",
  "switched_context",
  "done_enough",
]) as z.ZodType<FocusSessionExitReason>;
const focusSessionTaskOutcomeSchema = z.enum([
  "started",
  "advanced",
  "completed",
]) as z.ZodType<FocusSessionTaskOutcome>;
const sessionNoteSchema = z.string().trim().min(1).max(500);
const focusTaskIdSchema = z.string().uuid();

export const createFocusSessionSchema = z.object({
  taskId: focusTaskIdSchema,
  depth: focusSessionDepthSchema.optional(),
  plannedMinutes: z.number().int().min(5).max(180),
}) as z.ZodType<CreateFocusSessionRequest>;

export const captureFocusDistractionSchema = z.object({
  note: sessionNoteSchema,
}) as z.ZodType<CaptureFocusDistractionRequest>;

export const completeFocusSessionSchema = z.object({
  taskOutcome: focusSessionTaskOutcomeSchema,
  completionNote: z.string().trim().max(500).nullable().optional(),
}) as z.ZodType<CompleteFocusSessionRequest>;

export const abortFocusSessionSchema = z.object({
  exitReason: focusSessionExitReasonSchema,
  note: z.string().trim().max(500).nullable().optional(),
}) as z.ZodType<AbortFocusSessionRequest>;

export const focusTaskParamsSchema = z.object({
  taskId: focusTaskIdSchema,
});
