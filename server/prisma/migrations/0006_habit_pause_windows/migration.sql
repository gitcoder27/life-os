CREATE TYPE "HabitPauseKind" AS ENUM ('REST_DAY', 'VACATION');

CREATE TABLE "HabitPauseWindow" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "kind" "HabitPauseKind" NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HabitPauseWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HabitPauseWindow_habitId_startsOn_endsOn_idx"
ON "HabitPauseWindow"("habitId", "startsOn", "endsOn");

ALTER TABLE "HabitPauseWindow"
ADD CONSTRAINT "HabitPauseWindow_habitId_fkey"
FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
