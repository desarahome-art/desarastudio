-- ============================================================
-- Migration 002: Waiting list enhancements & tracking
-- ============================================================

-- Optional columns if directly querying in SQL
ALTER TABLE waiting_list ADD COLUMN IF NOT EXISTS jam_ingin TIME;
ALTER TABLE waiting_list ADD COLUMN IF NOT EXISTS kampus TEXT;
ALTER TABLE waiting_list ADD COLUMN IF NOT EXISTS dp_dibayar INT DEFAULT 100000;
