-- ============================================================
-- Migration 005: Menit per unit add-on, Add-on di Lapangan & Status Cetak
--
-- AMAN DIJALANKAN BERULANG (idempotent):
--   * Tidak ada DROP TABLE / DELETE / UPDATE data.
--   * Semua kolom memakai ADD COLUMN IF NOT EXISTS.
--   * Booking lama tetap berfungsi: menit_per_unit NULL dibaca sebagai 15 menit.
-- Jika versi lama file ini pernah dijalankan, cukup jalankan ulang versi ini.
-- ============================================================

-- ------------------------------------------------------------
-- 1. addons.menit_per_unit  (default 15, wajib > 0)
-- ------------------------------------------------------------
ALTER TABLE addons
  ADD COLUMN IF NOT EXISTS menit_per_unit INT NOT NULL DEFAULT 15;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'addons_menit_per_unit_check'
  ) THEN
    ALTER TABLE addons
      ADD CONSTRAINT addons_menit_per_unit_check CHECK (menit_per_unit > 0);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. booking_addons: salinan menit + penanda tambahan admin
--    menit_per_unit NULL = data lama -> aplikasi memakai 15 menit
-- ------------------------------------------------------------
ALTER TABLE booking_addons
  ADD COLUMN IF NOT EXISTS menit_per_unit INT;

ALTER TABLE booking_addons
  ADD COLUMN IF NOT EXISTS ditambah_oleh_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE booking_addons
  ADD COLUMN IF NOT EXISTS ditambah_pada TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 3. bookings.status_cetak
--    NULL      = booking tanpa fasilitas cetak
--    menunggu / proses / selesai = status pengerjaan cetak
--    (Jika kolom sudah ada dari versi lama / dibuat manual, kolom tidak diubah.)
-- ------------------------------------------------------------
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS status_cetak TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_cetak_check'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'status_cetak' AND data_type = 'text'
  ) THEN
    -- NOT VALID: hanya berlaku untuk data baru, data lama tidak diperiksa ulang
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_status_cetak_check
      CHECK (status_cetak IS NULL OR status_cetak IN ('menunggu', 'proses', 'selesai'))
      NOT VALID;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. RLS booking_addons
--    * Pengunjung tidak punya hak insert langsung (booking klien lewat Server Action).
--    * Insert/update/delete baris tambahan admin hanya oleh admin login
--      (policy "booking_addons_admin_all" = is_admin()).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "booking_addons_admin_manage" ON booking_addons; -- duplikat dari versi lama file ini

-- Insert oleh pengunjung (anon) sengaja TIDAK dibuat: booking klien ditulis lewat Server Action
-- (service role). Lihat migrasi 006.
DROP POLICY IF EXISTS "booking_addons_insert_anon" ON booking_addons;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'booking_addons' AND policyname = 'booking_addons_admin_all'
  ) THEN
    CREATE POLICY "booking_addons_admin_all" ON booking_addons
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. Fungsi transaksi: terapkan perubahan add-on di lapangan
--    Semua penulisan (booking_addons, bookings, log) dalam SATU transaksi.
--    Dipanggil dari Server Action dengan sesi admin (SECURITY INVOKER -> RLS berlaku).
--
--    p_update_rows : [{"id": "<uuid>", "jumlah": 3}]   jumlah 0 = hapus baris
--    p_insert_rows : [{"addon_id","jenis","nama","satuan","harga","jumlah","menit_per_unit"}]
--    p_cetak_aksi  : 'tetap' | 'menunggu' | 'kosongkan'
--    p_pilihan_background : NULL = tidak berubah
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION terapkan_addon_lapangan(
  p_booking_id          UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_update_rows         JSONB,
  p_insert_rows         JSONB,
  p_delta_harga         INT,
  p_delta_menit         INT,
  p_cetak_aksi          TEXT,
  p_pilihan_background  TEXT[],
  p_log                 TEXT,
  p_oleh                TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_row     JSONB;
  v_jumlah  INT;
  v_count   INT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin yang sudah login.' USING ERRCODE = '42501';
  END IF;

  -- Kunci baris booking agar tidak diubah dua admin bersamaan
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking tidak ditemukan.';
  END IF;

  IF v_booking.status::TEXT NOT IN ('pending', 'booking') THEN
    RAISE EXCEPTION 'Add-on di lapangan hanya untuk booking berstatus pending atau booking (status sekarang: %).', v_booking.status;
  END IF;

  IF p_expected_updated_at IS NOT NULL
     AND v_booking.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Data booking baru saja berubah. Muat ulang halaman lalu coba lagi.';
  END IF;

  -- Ubah / hapus baris tambahan admin (baris pesanan awal klien tidak bisa disentuh)
  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(p_update_rows, '[]'::JSONB)) LOOP
    v_jumlah := (v_row->>'jumlah')::INT;
    IF v_jumlah <= 0 THEN
      DELETE FROM booking_addons
       WHERE id = (v_row->>'id')::UUID
         AND booking_id = p_booking_id
         AND ditambah_oleh_admin = TRUE;
    ELSE
      UPDATE booking_addons
         SET ditambah_pada = CASE WHEN v_jumlah > jumlah THEN NOW() ELSE ditambah_pada END,
             jumlah = v_jumlah
       WHERE id = (v_row->>'id')::UUID
         AND booking_id = p_booking_id
         AND ditambah_oleh_admin = TRUE;
    END IF;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      RAISE EXCEPTION 'Baris add-on tidak ditemukan atau bukan tambahan di lapangan.';
    END IF;
  END LOOP;

  -- Baris baru (selalu ditandai tambahan admin)
  INSERT INTO booking_addons
    (booking_id, addon_id, jenis, nama, satuan, harga, jumlah, menit_per_unit, ditambah_oleh_admin, ditambah_pada)
  SELECT
    p_booking_id,
    (r->>'addon_id')::UUID,
    (r->>'jenis')::addon_jenis,
    r->>'nama',
    r->>'satuan',
    (r->>'harga')::INT,
    (r->>'jumlah')::INT,
    (r->>'menit_per_unit')::INT,
    TRUE,
    NOW()
  FROM jsonb_array_elements(COALESCE(p_insert_rows, '[]'::JSONB)) AS r;

  -- Hitung ulang total & durasi (sisa_pelunasan = generated column, ikut otomatis)
  UPDATE bookings
     SET total_harga        = GREATEST(0, total_harga + COALESCE(p_delta_harga, 0)),
         durasi_total       = GREATEST(1, durasi_total + COALESCE(p_delta_menit, 0)),
         pilihan_background = COALESCE(p_pilihan_background, pilihan_background),
         status_cetak       = CASE p_cetak_aksi
                                WHEN 'menunggu'  THEN 'menunggu'
                                WHEN 'kosongkan' THEN NULL
                                ELSE status_cetak
                              END
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  INSERT INTO booking_status_log (booking_id, status_dari, status_ke, catatan, oleh)
  VALUES (
    p_booking_id,
    v_booking.status,
    v_booking.status,
    p_log,
    COALESCE(auth.jwt()->>'email', p_oleh, 'admin')
  );

  RETURN jsonb_build_object(
    'total_harga',    v_booking.total_harga,
    'durasi_total',   v_booking.durasi_total,
    'sisa_pelunasan', v_booking.sisa_pelunasan
  );
END;
$$;

REVOKE ALL ON FUNCTION terapkan_addon_lapangan(UUID, TIMESTAMPTZ, JSONB, JSONB, INT, INT, TEXT, TEXT[], TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION terapkan_addon_lapangan(UUID, TIMESTAMPTZ, JSONB, JSONB, INT, INT, TEXT, TEXT[], TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION terapkan_addon_lapangan(UUID, TIMESTAMPTZ, JSONB, JSONB, INT, INT, TEXT, TEXT[], TEXT, TEXT) TO authenticated;
