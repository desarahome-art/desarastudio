-- ============================================================
-- 007 — Tabel pengeluaran (untuk menu Laporan keuangan)
-- Aman dijalankan berulang (idempotent). Jalankan di Supabase > SQL Editor.
-- Semua pengeluaran diisi manual oleh admin (termasuk biaya cetak foto, kategori "Cetak foto").
-- Pasangannya: tabel pemasukan (migrasi 008).
-- ============================================================

CREATE TABLE IF NOT EXISTS pengeluaran (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tanggal     DATE NOT NULL,
  kategori    TEXT NOT NULL,
  keterangan  TEXT NOT NULL,
  jumlah      INT  NOT NULL CHECK (jumlah > 0),
  dibuat_oleh TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pengeluaran_tanggal ON pengeluaran (tanggal);

ALTER TABLE pengeluaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pengeluaran_admin_all" ON pengeluaran;
CREATE POLICY "pengeluaran_admin_all" ON pengeluaran
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
