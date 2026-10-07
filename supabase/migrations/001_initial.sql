-- ============================================================
-- Desara Home Studio – Initial Migration
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  urutan     INT  NOT NULL DEFAULT 0,
  aktif      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PACKAGES
-- ============================================================
CREATE TABLE packages (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id              UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  nama                     TEXT NOT NULL,
  harga                    INT  NOT NULL DEFAULT 0,   -- rupiah
  durasi_menit             INT  NOT NULL DEFAULT 60,
  jumlah_pilihan_background INT NOT NULL DEFAULT 1,
  maks_orang               INT  NOT NULL DEFAULT 1,
  cetak_ukuran             TEXT,                       -- e.g. "12R", NULL = tanpa cetak
  cetak_jumlah             INT,
  jumlah_foto_edit         INT,
  bonus                    TEXT,
  urutan                   INT  NOT NULL DEFAULT 0,
  aktif                    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADD-ONS
-- ============================================================
CREATE TYPE addon_jenis AS ENUM ('waktu', 'background', 'orang', 'cetak');

CREATE TABLE addons (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jenis       addon_jenis NOT NULL,
  nama        TEXT NOT NULL,
  satuan      TEXT NOT NULL,              -- e.g. "+15 menit", "+1 background"
  harga       INT  NOT NULL DEFAULT 0,
  maks        INT  NOT NULL DEFAULT 5,
  ukuran      TEXT,                       -- hanya untuk cetak
  urutan      INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- junction: addon aktif per kategori
CREATE TABLE addon_categories (
  addon_id    UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (addon_id, category_id)
);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TYPE booking_status AS ENUM ('pending', 'booking', 'selesai', 'dibatalkan');

CREATE TABLE bookings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode             TEXT NOT NULL UNIQUE,
  nama_klien       TEXT NOT NULL,
  wa_klien         TEXT NOT NULL,
  kampus           TEXT,
  tanggal          DATE NOT NULL,
  jam_mulai        TIME NOT NULL,
  durasi_total     INT  NOT NULL,        -- menit (paket + addon waktu)
  -- snapshot paket
  category_id      UUID REFERENCES categories(id),
  category_nama    TEXT NOT NULL,
  package_id       UUID REFERENCES packages(id),
  package_nama     TEXT NOT NULL,
  package_harga    INT  NOT NULL,
  package_snapshot JSONB NOT NULL,       -- seluruh isi paket saat booking
  -- financial
  total_harga      INT  NOT NULL,
  dp_dibayar       INT  NOT NULL DEFAULT 0,
  sisa_pelunasan   INT  GENERATED ALWAYS AS (total_harga - dp_dibayar) STORED,
  -- metadata
  catatan          TEXT,
  pilihan_background TEXT[],
  bukti_transfer   TEXT,                 -- storage path
  status           booking_status NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BOOKING ADD-ONS (snapshot)
-- ============================================================
CREATE TABLE booking_addons (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  addon_id    UUID REFERENCES addons(id),
  jenis       addon_jenis NOT NULL,
  nama        TEXT NOT NULL,
  satuan      TEXT NOT NULL,
  harga       INT  NOT NULL,
  jumlah      INT  NOT NULL DEFAULT 1,
  total       INT  GENERATED ALWAYS AS (harga * jumlah) STORED
);

-- ============================================================
-- BOOKING STATUS LOG
-- ============================================================
CREATE TABLE booking_status_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status_dari booking_status,
  status_ke   booking_status NOT NULL,
  catatan     TEXT,
  oleh        TEXT,                      -- email admin atau 'system'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WAITING LIST
-- ============================================================
CREATE TABLE waiting_list (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama          TEXT NOT NULL,
  wa            TEXT NOT NULL,
  category_id   UUID REFERENCES categories(id),
  category_nama TEXT NOT NULL,
  tanggal_ingin DATE,
  catatan       TEXT,
  sudah_dihubungi BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: updated_at bookings
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TRIGGER: auto-generate kode booking
-- ============================================================
CREATE OR REPLACE FUNCTION generate_kode_booking()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  tgl TEXT;
  seq INT;
  kode TEXT;
BEGIN
  tgl := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO seq
    FROM bookings
    WHERE DATE(created_at) = CURRENT_DATE;
  kode := 'DSR-' || tgl || '-' || LPAD(seq::TEXT, 3, '0');
  NEW.kode := kode;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_kode
  BEFORE INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.kode IS NULL OR NEW.kode = '')
  EXECUTE FUNCTION generate_kode_booking();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_addons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list       ENABLE ROW LEVEL SECURITY;

-- Helper function: is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (auth.role() = 'authenticated');
END;
$$;

-- SETTINGS: public read (non-sensitive keys), admin write
CREATE POLICY "settings_public_read" ON settings
  FOR SELECT USING (key NOT IN ('admin_email'));

CREATE POLICY "settings_admin_write" ON settings
  FOR ALL USING (is_admin());

-- CATEGORIES: public read, admin write
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (TRUE);

CREATE POLICY "categories_admin_write" ON categories
  FOR ALL USING (is_admin());

-- PACKAGES: public read, admin write
CREATE POLICY "packages_public_read" ON packages
  FOR SELECT USING (TRUE);

CREATE POLICY "packages_admin_write" ON packages
  FOR ALL USING (is_admin());

-- ADDONS: public read, admin write
CREATE POLICY "addons_public_read" ON addons
  FOR SELECT USING (TRUE);

CREATE POLICY "addons_admin_write" ON addons
  FOR ALL USING (is_admin());

CREATE POLICY "addon_categories_public_read" ON addon_categories
  FOR SELECT USING (TRUE);

CREATE POLICY "addon_categories_admin_write" ON addon_categories
  FOR ALL USING (is_admin());

-- BOOKINGS: insert via server action (anon + auth), admin full
CREATE POLICY "bookings_insert_anon" ON bookings
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "bookings_admin_all" ON bookings
  FOR ALL USING (is_admin());

-- BOOKING_ADDONS: insert anon, admin all
CREATE POLICY "booking_addons_insert_anon" ON booking_addons
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "booking_addons_admin_all" ON booking_addons
  FOR ALL USING (is_admin());

-- BOOKING_STATUS_LOG: insert (via server), admin read
CREATE POLICY "booking_status_log_insert" ON booking_status_log
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "booking_status_log_admin_read" ON booking_status_log
  FOR SELECT USING (is_admin());

CREATE POLICY "booking_status_log_admin_update" ON booking_status_log
  FOR UPDATE USING (is_admin());

CREATE POLICY "booking_status_log_admin_delete" ON booking_status_log
  FOR DELETE USING (is_admin());

-- WAITING_LIST: insert anon, admin all
CREATE POLICY "waiting_list_insert_anon" ON waiting_list
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "waiting_list_admin_all" ON waiting_list
  FOR ALL USING (is_admin());

-- ============================================================
-- STORAGE: bukti transfer bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('bukti-transfer', 'bukti-transfer', FALSE)
ON CONFLICT DO NOTHING;

CREATE POLICY "allow_anon_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'bukti-transfer');

CREATE POLICY "allow_admin_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'bukti-transfer' AND is_admin());
