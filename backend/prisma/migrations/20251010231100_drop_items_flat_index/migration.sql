-- Drop oversized B-tree index on JSON column
DROP INDEX IF EXISTS "idx_checklists_items_flat";

-- Remove flattened items column since we only persist raw JSON
ALTER TABLE "checklists"
	DROP COLUMN IF EXISTS "items_flat";
