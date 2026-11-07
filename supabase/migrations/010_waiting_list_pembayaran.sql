-- ============================================================
-- 010 — Pembayaran di Waiting List (DP, cicilan, pelunasan, koreksi)
-- Aman dijalankan berulang (idempotent). Jalankan di Supabase > SQL Editor.
-- Syarat: migrasi 001–009 sudah dijalankan.
--
-- waiting_list.dp_dibayar = total yang SUDAH DIKONFIRMASI admin (bukan lagi angka DP dari Pengaturan).
-- waiting_list_pembayaran  = riwayat setiap pembayaran/koreksi.
-- Saat waiting list dipindah ke booking, dp_dibayar ikut menjadi bookings.dp_dibayar.
-- ============================================================

-- Kolom total dibayar di waiting_list. Sebagian database belum punya kolom ini
-- (migrasi 002 tidak selalu dijalankan), jadi dibuat di sini bila belum ada.
ALTER TABLE waiting_list ADD COLUMN IF NOT EXISTS dp_dibayar INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS waiting_list_pembayaran (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  waiting_list_id  UUID NOT NULL REFERENCES waiting_list(id) ON DELETE CASCADE,
  jenis            TEXT NOT NULL CHECK (jenis IN ('dp', 'cicilan', 'pelunasan', 'koreksi')),
  -- Pembayaran: nominal yang dibayar (> 0). Koreksi: selisih (boleh negatif).
  jumlah           INT  NOT NULL,
  metode           TEXT CHECK (metode IN ('transfer', 'tunai')),
  dibayar_sebelum  INT  NOT NULL,
  dibayar_sesudah  INT  NOT NULL CHECK (dibayar_sesudah >= 0),
  catatan          TEXT,
  oleh             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wl_pembayaran_wl ON waiting_list_pembayaran (waiting_list_id, created_at);

ALTER TABLE waiting_list_pembayaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wl_pembayaran_admin_all" ON waiting_list_pembayaran;
CREATE POLICY "wl_pembayaran_admin_all" ON waiting_list_pembayaran
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Waiting list baru mulai dari 0 = "Menunggu konfirmasi" sampai admin mencocokkan bukti transfer
ALTER TABLE waiting_list ALTER COLUMN dp_dibayar SET DEFAULT 0;

-- Data lama: nilai 100.000 sebelumnya hanya angka bawaan, bukan uang yang sudah dicek.
-- Reset ke 0 HANYA untuk waiting list yang belum punya riwayat pembayaran,
-- jadi aman bila file ini dijalankan ulang setelah admin mulai mencatat pembayaran.
UPDATE waiting_list w
SET dp_dibayar = 0
WHERE w.dp_dibayar IS DISTINCT FROM 0
  AND NOT EXISTS (SELECT 1 FROM waiting_list_pembayaran p WHERE p.waiting_list_id = w.id);

ALTER TABLE waiting_list ALTER COLUMN dp_dibayar SET NOT NULL;
