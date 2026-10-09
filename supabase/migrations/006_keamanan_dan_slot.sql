-- ============================================================
-- 006 — Pengetatan keamanan + kunci slot di database
-- Aman dijalankan berulang (idempotent). Jalankan di Supabase > SQL Editor.
-- Syarat: migrasi 001–005 sudah dijalankan.
-- ============================================================

-- 1) Tutup jalur "masukkan data langsung dengan anon key".
--    Semua pembuatan booking / add-on / waiting list di website berjalan lewat Server Action
--    (service role), jadi anon tidak perlu hak INSERT. Sebelumnya policy-nya WITH CHECK (TRUE),
--    sehingga siapa pun yang punya anon key bisa memasukkan booking palsu tanpa cek harga/slot.
DROP POLICY IF EXISTS "bookings_insert_anon"        ON bookings;
DROP POLICY IF EXISTS "booking_addons_insert_anon"  ON booking_addons;
DROP POLICY IF EXISTS "booking_status_log_insert"   ON booking_status_log;
DROP POLICY IF EXISTS "waiting_list_insert_anon"    ON waiting_list;

-- Admin yang login tetap boleh menulis log (dipakai fungsi terapkan_addon_lapangan & aplikasi Android).
-- bookings / booking_addons / waiting_list sudah punya policy *_admin_all (FOR ALL).
DROP POLICY IF EXISTS "booking_status_log_admin_insert" ON booking_status_log;
CREATE POLICY "booking_status_log_admin_insert" ON booking_status_log
  FOR INSERT WITH CHECK (is_admin());

-- 2) Cegah dua booking aktif di jam mulai yang sama (kapasitas 1 per jam mulai).
--    Menutup celah "dua klien menekan kirim bersamaan". Aturan sama dengan aplikasi:
--    hanya pending/booking yang menghalangi; booking selesai/dibatalkan tidak.
--    Jika sudah ada data ganda lama, indeks DILEWATI (muncul NOTICE) — rapikan dulu data gandanya.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE status IN ('pending', 'booking')
    GROUP BY tanggal, jam_mulai
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Indeks uq_bookings_slot_aktif DILEWATI: ada booking aktif ganda pada tanggal+jam yang sama. Rapikan dulu, lalu jalankan ulang file ini.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_slot_aktif
      ON bookings (tanggal, jam_mulai)
      WHERE status IN ('pending', 'booking');
  END IF;
END $$;
