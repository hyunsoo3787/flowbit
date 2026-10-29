-- AlterTable
ALTER TABLE "boards" ALTER COLUMN "background" SET DEFAULT '#93c5fd';

-- Boards used to store a named color. Map each name to its new, lighter
-- preset (see BOARD_BACKGROUND_PRESETS in @flowbit/shared).
UPDATE "boards" SET "background" = CASE "background"
  WHEN 'blue' THEN '#93c5fd'
  WHEN 'green' THEN '#86efac'
  WHEN 'orange' THEN '#fdba74'
  WHEN 'red' THEN '#fca5a5'
  WHEN 'purple' THEN '#c4b5fd'
  WHEN 'pink' THEN '#f9a8d4'
  WHEN 'teal' THEN '#5eead4'
  WHEN 'slate' THEN '#cbd5e1'
  ELSE '#93c5fd'
END
WHERE "background" !~ '^#[0-9a-f]{6}$';
