-- ============================================================
-- Desara Home Studio – Seed Data
-- ============================================================

-- SETTINGS
INSERT INTO settings (key, value) VALUES
  ('nama_studio',       '"Desara Home Studio"'),
  ('wa_admin',          '"6281234567890"'),
  ('rekening_bni',      '"1234567890"'),
  ('nama_rekening',     '"Desara Studio"'),
  ('dp_minimal',        '100000'),
  ('teks_sambutan',     '"Selamat datang di Desara Home Studio, Pontianak 📸"'),
  ('tampilkan_waiting', 'true'),
  ('jam_buka',          '"08:00"'),
  ('jam_tutup',         '"20:00"'),
  ('slot_interval',     '30'),
  ('backgrounds', '[
    "Putih Bersih",
    "Abu-abu Netral",
    "Krem Hangat",
    "Hijau Forest",
    "Biru Muda",
    "Pink Dusty",
    "Hitam Elegan",
    "Maroon",
    "Navy",
    "Sage Green"
  ]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- CATEGORIES
INSERT INTO categories (id, nama, slug, urutan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Wisuda',     'wisuda',     1),
  ('22222222-2222-2222-2222-222222222222', 'Prewedding', 'prewedding', 2),
  ('33333333-3333-3333-3333-333333333333', 'Keluarga',   'keluarga',   3),
  ('44444444-4444-4444-4444-444444444444', 'Group',      'group',      4),
  ('55555555-5555-5555-5555-555555555555', 'Portrait',   'portrait',   5)
ON CONFLICT (slug) DO NOTHING;

-- PACKAGES – Wisuda
INSERT INTO packages (category_id, nama, harga, durasi_menit, jumlah_pilihan_background, maks_orang, jumlah_foto_edit, bonus, urutan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Bronze', 300000, 30, 2, 6, 10, NULL, 1);

INSERT INTO packages (category_id, nama, harga, durasi_menit, jumlah_pilihan_background, maks_orang, cetak_ukuran, cetak_jumlah, jumlah_foto_edit, bonus, urutan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Silver', 450000, 45, 3, 8, '12R', 1, 15, 'Softfile semua foto', 2);

-- ADD-ONS
INSERT INTO addons (id, jenis, nama, satuan, harga, maks, urutan) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'waktu',      'Tambah Waktu',       '+15 menit',   50000, 4, 1),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'background', 'Tambah Background',  '+1 background', 30000, 3, 2),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'orang',      'Tambah Orang',       '+1 orang',    25000, 5, 3),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'cetak',      'Cetak 4R',           '+1 lembar',   15000, 10, 4),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'cetak',      'Cetak 10R',          '+1 lembar',   35000, 5,  5),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'cetak',      'Cetak 12R',          '+1 lembar',   50000, 5,  6)
ON CONFLICT DO NOTHING;

-- ADDON_CATEGORIES – aktifkan semua add-on untuk semua kategori
INSERT INTO addon_categories (addon_id, category_id)
SELECT a.id, c.id FROM addons a CROSS JOIN categories c
ON CONFLICT DO NOTHING;
