-- ============================================================
-- Migration 004: Perbaikan trigger generate_kode_booking
-- Menghindari "duplicate key value violates unique constraint bookings_kode_key"
-- yang disebabkan oleh penggunaan COUNT(*) + 1 (ketika ada booking yang dihapus atau race condition)
-- ============================================================

CREATE OR REPLACE FUNCTION generate_kode_booking()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  tgl TEXT;
  prefix TEXT;
  max_seq INT := 0;
  seq INT;
  candidate_kode TEXT;
BEGIN
  -- Jika kode sudah diisi dan bukan kosong, jangan timpa
  IF NEW.kode IS NOT NULL AND TRIM(NEW.kode) <> '' THEN
    RETURN NEW;
  END IF;

  -- Gunakan zona waktu Indonesia/Jakarta (WIB)
  tgl := TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD');
  prefix := 'DSR-' || tgl || '-';

  -- Ambil nomor urut tertinggi yang sudah ada di database untuk hari ini
  SELECT COALESCE(
    MAX(
      SUBSTRING(kode FROM LENGTH(prefix) + 1)::INT
    ),
    0
  )
  INTO max_seq
  FROM bookings
  WHERE kode ~ ('^' || prefix || '[0-9]+$');

  seq := max_seq + 1;
  candidate_kode := prefix || LPAD(seq::TEXT, 3, '0');

  -- Loop pengaman untuk memastikan kode belum pernah digunakan sama sekali
  WHILE EXISTS (SELECT 1 FROM bookings WHERE kode = candidate_kode) LOOP
    seq := seq + 1;
    candidate_kode := prefix || LPAD(seq::TEXT, 3, '0');
  END LOOP;

  NEW.kode := candidate_kode;
  RETURN NEW;
END;
$$;

-- Pasang ulang trigger tanpa WHEN clause agar semua insert (NULL / '') tertangani
DROP TRIGGER IF EXISTS bookings_kode ON bookings;
CREATE TRIGGER bookings_kode
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION generate_kode_booking();
