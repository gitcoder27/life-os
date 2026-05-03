import type {
  ApplyShapeDayRequest,
  DriftRecoveryRequest,
  ShapeDayPreviewRequest,
} from "@life-os/contracts";
import { z } from "zod";

const entityIdSchema = z.string().trim().min(1);
const isoDateTimeSchema = z.string().datetime({ offset: true });

const shapeDayTaskPreviewItemSchema = z.object({
  taskId: entityIdSchema,
  title: z.string().trim().min(1).max(300),
  estimatedMinutes: z.number().int().positive().max(720),
  assumedMinutes: z.boolean(),
});

const shapeDayProposedBlockSchema = z.object({
  tempId: z.string().trim().min(1).max(80),
  title: z.string().trim().max(120).nullable(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  taskIds: z.array(entityIdSchema).min(1).max(20),
  tasks: z.array(shapeDayTaskPreviewItemSchema).max(20),
});

export const shapeDayPreviewSchema = z.object({
  preserveExistingBlocks: z.boolean().optional(),
}) as z.ZodType<ShapeDayPreviewRequest>;

export const applyShapeDaySchema = z.object({
  proposedBlocks: z.array(shapeDayProposedBlockSchema).min(1).max(24),
}) as z.ZodType<ApplyShapeDayRequest>;

export const driftRecoverySchema = z.object({
  mode: z.enum(["preview", "apply"]),
  action: z.enum([
    "move_to_current_block",
    "move_to_next_block",
    "unplan",
    "carry_forward_tomorrow",
    "shrink_to_five_minutes",
    "activate_reduced_day",
  ]),
  taskIds: z.array(entityIdSchema).max(50).optional(),
  targetBlockId: entityIdSchema.nullable().optional(),
}) as z.ZodType<DriftRecoveryRequest>;
