CREATE INDEX "Task_userId_status_originType_scheduledForDate_kind_createdAt_id_idx"
ON "Task"("userId", "status", "originType", "scheduledForDate", "kind", "createdAt", "id");
