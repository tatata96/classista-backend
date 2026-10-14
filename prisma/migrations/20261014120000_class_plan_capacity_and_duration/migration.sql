-- Replaces ClassPlan/ClassSession.capacity with totalCapacity + classistaCapacity,
-- and ClassPlan.endTime with durationMinutes.
--
-- The old single capacity cannot be split into the two new values without
-- inventing a total capacity, and endTime cannot be converted safely for
-- plans that end at midnight. So this migration refuses to run if either table
-- has rows, instead of guessing or resetting data. (Both tables were empty
-- when this was written.) If it fails, migrate the rows by hand first.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ClassPlan") OR EXISTS (SELECT 1 FROM "ClassSession") THEN
    RAISE EXCEPTION 'ClassPlan/ClassSession contain rows: capacity and endTime cannot be migrated reliably. Migrate or remove them deliberately, then re-run.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "ClassPlan" DROP COLUMN "capacity",
DROP COLUMN "endTime",
ADD COLUMN     "classistaCapacity" INTEGER NOT NULL,
ADD COLUMN     "durationMinutes" INTEGER NOT NULL,
ADD COLUMN     "totalCapacity" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ClassSession" DROP COLUMN "capacity",
ADD COLUMN     "classistaCapacity" INTEGER NOT NULL,
ADD COLUMN     "totalCapacity" INTEGER NOT NULL;

