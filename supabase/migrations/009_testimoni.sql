-- ============================================================
-- 009 — Tabel testimoni (form client + halaman tampil)
-- Aman dijalankan berulang (idempotent). Jalankan di Supabase > SQL Editor.
-- Alur: client isi form /testimoni (lewat server action, service role) -> status 'menunggu'
--       -> admin setujui di menu Testimoni -> tampil di halaman utama (bagian bawah).
-- ============================================================

CREATE TABLE IF NOT EXISTS testimoni (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama             TEXT NOT NULL CHECK (char_length(nama) BETWEEN 2 AND 40),
  paket            TEXT,
  bintang          INT  NOT NULL CHECK (bintang BETWEEN 1 AND 5),
  isi              TEXT NOT NULL CHECK (char_length(isi) BETWEEN 10 AND 400),
  status           TEXT NOT NULL DEFAULT 'menunggu'
                   CHECK (status IN ('menunggu', 'disetujui', 'disembunyikan')),
  -- Hash IP pengirim (bukan IP asli) untuk membatasi jumlah kiriman per hari
  kunci_pengirim   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  disetujui_pada   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_testimoni_status ON testimoni (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimoni_pengirim ON testimoni (kunci_pengirim, created_at);

ALTER TABLE testimoni ENABLE ROW LEVEL SECURITY;

-- Admin: akses penuh
DROP POLICY IF EXISTS "testimoni_admin_all" ON testimoni;
CREATE POLICY "testimoni_admin_all" ON testimoni
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Publik: hanya boleh MEMBACA testimoni yang sudah disetujui. Tidak ada policy INSERT untuk anon;
-- kiriman client lewat server action (service role) agar batas kirim & validasi tidak bisa dilewati.
DROP POLICY IF EXISTS "testimoni_public_read" ON testimoni;
CREATE POLICY "testimoni_public_read" ON testimoni
  FOR SELECT USING (status = 'disetujui');
