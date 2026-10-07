-- ============================================================
-- Migration 003: Wisuda Events & Waiting List per-event slot blocking
-- ============================================================

-- 1. Tabel wisuda_events: menyimpan daftar acara wisuda yang dibuat admin
CREATE TABLE IF NOT EXISTS wisuda_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        TEXT NOT NULL,                        -- cth. "Wisuda UNTAN Oktober 2026"
  kampus      TEXT NOT NULL,                        -- cth. "Universitas Tanjungpura"
  keterangan  TEXT,                                 -- cth. "Gelombang 1"
  aktif       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk query aktif
CREATE INDEX IF NOT EXISTS idx_wisuda_events_aktif ON wisuda_events (aktif);

-- 2. Kolom baru di tabel waiting_list
--    acara_id   : FK ke wisuda_events (nullable, mode baru)
--    acara_nama  : nama acara saat submit (denormalized untuk kemudahan)
--    package_nama: nama paket foto yang dipilih client

ALTER TABLE waiting_list ADD COLUMN IF NOT EXISTS acara_id   UUID REFERENCES wisuda_events(id) ON DELETE SET NULL;
ALTER TABLE waiting_list ADD COLUMN IF NOT EXISTS acara_nama  TEXT;
ALTER TABLE waiting_list ADD COLUMN IF NOT EXISTS package_nama TEXT;

-- Index untuk query slot per acara
CREATE INDEX IF NOT EXISTS idx_waiting_list_acara_id ON waiting_list (acara_id);

-- ============================================================
-- RLS: wisuda_events (dibaca public, dikelola admin)
-- ============================================================
ALTER TABLE wisuda_events ENABLE ROW LEVEL SECURITY;

-- Siapa saja bisa baca (untuk form waiting list publik)
-- CREATE POLICY tidak mendukung IF NOT EXISTS, gunakan DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'wisuda_events'
      AND policyname = 'wisuda_events_public_read'
  ) THEN
    CREATE POLICY "wisuda_events_public_read"
      ON wisuda_events FOR SELECT
      USING (true);
  END IF;
END
$$;

-- Hanya service_role (admin) yang bisa insert/update/delete
-- (sudah di-handle oleh createAdminClient yang pakai service_role key)

-- ============================================================
-- Contoh data awal (opsional, hapus jika tidak diperlukan)
-- ============================================================
-- INSERT INTO wisuda_events (nama, kampus, keterangan, aktif)
-- VALUES
--   ('Wisuda UNTAN Semester Gasal 2026', 'Universitas Tanjungpura', 'Gelombang 1', true),
--   ('Wisuda Polnep 2026', 'Politeknik Negeri Pontianak', null, true)
-- ON CONFLICT DO NOTHING;
