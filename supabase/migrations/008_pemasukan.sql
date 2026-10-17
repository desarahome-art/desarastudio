-- ============================================================
-- 008 — Tabel pemasukan (laporan keuangan serba manual)
-- Aman dijalankan berulang (idempotent). Jalankan di Supabase > SQL Editor.
-- Syarat: migrasi 001–007 sudah dijalankan.
-- Laporan hanya membaca tabel pemasukan + pengeluaran yang diisi admin.
-- Satu baris = satu item pada satu tanggal (paket, add-on, atau lainnya).
-- ============================================================

CREATE TABLE IF NOT EXISTS pemasukan (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal      DATE NOT NULL,
  jenis        TEXT NOT NULL CHECK (jenis IN ('Paket', 'Add-on', 'Lainnya')),
  nama         TEXT NOT NULL,
  jumlah       INT  NOT NULL CHECK (jumlah > 0),
  harga_satuan INT  NOT NULL CHECK (harga_satuan >= 0),
  dibuat_oleh  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pemasukan_tanggal ON pemasukan (tanggal);

ALTER TABLE pemasukan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pemasukan_admin_all" ON pemasukan;
CREATE POLICY "pemasukan_admin_all" ON pemasukan
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
