# BLUEPRINT APLIKASI ANDROID BARU — ADMIN DESARA HOME STUDIO

Versi: 9 Oktober 2026. Disusun dari kode website SAAT INI (Next.js 14 + Supabase), termasuk add-on di lapangan, `menit_per_unit`, `status_cetak`, migrasi `005_addon_lapangan_menit.sql`, dan `src/lib/addon-calc.ts`. Semua aturan sudah dicocokkan ke kode, bukan disalin dari `AUDIT_FITUR.md`.

**Untuk siapa:** AI coding assistant yang akan membangun aplikasi Android admin dari nol TANPA akses ke kode web, dan pemilik studio (bukan programmer).

**Cara membaca:**
- Nama tabel, kolom, fungsi, dan nilai status ditulis persis seperti di kode. Sumber ditulis sebagai `file › fungsi`.
- "TIDAK JELAS" artinya perlu dicek dulu; daftarnya ada di akhir dokumen.
- Tidak ada nilai rahasia di dokumen ini, hanya nama variabel.

> PENTING: Migrasi `005_addon_lapangan_menit.sql` mungkin BELUM dijalankan di database produksi. Fitur add-on di lapangan dan kolom `menit_per_unit` bergantung padanya.

---

## DAFTAR ISI

1. Skema Database (Sumber Kebenaran)
2. Letak Logika dan Rencana RPC (termasuk 2.6 Daftar RPC)
3. Aturan Bisnis dan Rumus (termasuk 3.12 Contoh Uji)
4. Layar dan Fitur Admin
5. Desain dan Identitas Visual
6. Integrasi
7. Risiko
8. Rekomendasi Teknologi Android
- Lampiran A — Matriks Paritas
- Daftar hal TIDAK JELAS
- Daftar RPC & perubahan database yang BELUM ada

---

## BAGIAN 1 — SKEMA DATABASE (SUMBER KEBENARAN)

Sumber: `supabase/migrations/001_initial.sql`, `002_waiting_list_updates.sql`, `003_wisuda_events.sql`, `004_fix_kode_booking.sql`, `005_addon_lapangan_menit.sql`, dan `supabase/seed.sql`.

Ekstensi: `uuid-ossp` (001). Kecuali disebut lain, `id` memakai `uuid_generate_v4()`.

### 1.1 Tipe ENUM

| Nama tipe | Nilai | Sumber |
|---|---|---|
| `addon_jenis` | `'waktu'`, `'background'`, `'orang'`, `'cetak'` | 001 |
| `booking_status` | `'pending'`, `'booking'`, `'selesai'`, `'dibatalkan'` | 001 |
| `cetak_status` | `'menunggu'`, `'proses'`, `'selesai'` | HANYA ada jika versi LAMA file 005 pernah dijalankan. Versi baru 005 memakai TEXT + CHECK. Lihat 1.2.6 |

### 1.2 Tabel

#### 1.2.1 `settings`
| Kolom | Tipe | Null | Default | Keterangan |
|---|---|---|---|---|
| `key` | TEXT | NOT NULL | – | PRIMARY KEY |
| `value` | JSONB | NOT NULL | – | Bentuk tergantung key (lihat 1.6) |
| `updated_at` | TIMESTAMPTZ | ya | `NOW()` | Diperbarui trigger `settings_updated_at` |

Tidak ada kolom `created_at` (AUDIT_FITUR.md lama keliru).

#### 1.2.2 `categories`
| Kolom | Tipe | Null | Default | Keterangan |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `nama` | TEXT | NOT NULL | – | |
| `slug` | TEXT | NOT NULL | – | UNIQUE |
| `urutan` | INT | NOT NULL | `0` | Urutan tampil |
| `aktif` | BOOLEAN | NOT NULL | `TRUE` | Kategori nonaktif tidak tampil di web klien |
| `created_at` | TIMESTAMPTZ | ya | `NOW()` | |

Tidak ada kolom `deskripsi` (AUDIT_FITUR.md lama keliru).

#### 1.2.3 `packages`
| Kolom | Tipe | Null | Default | Keterangan |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `category_id` | UUID | NOT NULL | – | FK → `categories(id)` ON DELETE CASCADE |
| `nama` | TEXT | NOT NULL | – | |
| `harga` | INT | NOT NULL | `0` | Rupiah, bilangan bulat |
| `durasi_menit` | INT | NOT NULL | `60` | |
| `jumlah_pilihan_background` | INT | NOT NULL | `1` | Kuota warna background bawaan paket |
| `maks_orang` | INT | NOT NULL | `1` | |
| `cetak_ukuran` | TEXT | ya | – | cth. `"12R"`, NULL = tanpa cetak |
| `cetak_jumlah` | INT | ya | – | |
| `jumlah_foto_edit` | INT | ya | – | |
| `bonus` | TEXT | ya | – | |
| `urutan` | INT | NOT NULL | `0` | |
| `aktif` | BOOLEAN | NOT NULL | `TRUE` | |
| `created_at` | TIMESTAMPTZ | ya | `NOW()` | |

#### 1.2.4 `addons`
| Kolom | Tipe | Null | Default | Keterangan |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `jenis` | `addon_jenis` | NOT NULL | – | |
| `nama` | TEXT | NOT NULL | – | |
| `satuan` | TEXT | NOT NULL | – | Label, cth. `"+20 menit"`, `"+1 lembar"` |
| `harga` | INT | NOT NULL | `0` | Rupiah per unit |
| `maks` | INT | NOT NULL | `5` | Batas total unit per booking |
| `ukuran` | TEXT | ya | – | Hanya untuk cetak |
| `urutan` | INT | NOT NULL | `0` | |
| `menit_per_unit` | INT | NOT NULL | `15` | (005) CHECK `addons_menit_per_unit_check`: `menit_per_unit > 0`. Hanya bermakna untuk `jenis='waktu'` |
| `created_at` | TIMESTAMPTZ | ya | `NOW()` | |

Tidak ada kolom `aktif` dan tidak ada kolom `category_id`. Keaktifan per kategori ditentukan oleh tabel `addon_categories`.

#### 1.2.5 `addon_categories`
| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `addon_id` | UUID | NOT NULL | FK → `addons(id)` ON DELETE CASCADE |
| `category_id` | UUID | NOT NULL | FK → `categories(id)` ON DELETE CASCADE |

PRIMARY KEY (`addon_id`, `category_id`). Baris ada = add-on aktif untuk kategori tersebut.

#### 1.2.6 `bookings`
| Kolom | Tipe | Null | Default | Keterangan |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `kode` | TEXT | NOT NULL | – | UNIQUE. Diisi trigger jika kosong (lihat 1.3) |
| `nama_klien` | TEXT | NOT NULL | – | |
| `wa_klien` | TEXT | NOT NULL | – | Disimpan apa adanya dari input klien |
| `kampus` | TEXT | ya | – | |
| `tanggal` | DATE | NOT NULL | – | `YYYY-MM-DD` |
| `jam_mulai` | TIME | NOT NULL | – | Dibaca dari API sebagai `"HH:MM:SS"` |
| `durasi_total` | INT | NOT NULL | – | Menit = durasi paket + add-on waktu |
| `category_id` | UUID | ya | – | FK → `categories(id)` (tanpa ON DELETE) |
| `category_nama` | TEXT | NOT NULL | – | Salinan nama |
| `package_id` | UUID | ya | – | FK → `packages(id)` (tanpa ON DELETE) |
| `package_nama` | TEXT | NOT NULL | – | Salinan |
| `package_harga` | INT | NOT NULL | – | Salinan harga paket |
| `package_snapshot` | JSONB | NOT NULL | – | Salinan seluruh baris `packages` saat booking dibuat atau diganti |
| `total_harga` | INT | NOT NULL | – | Rupiah |
| `dp_dibayar` | INT | NOT NULL | `0` | |
| `sisa_pelunasan` | INT | – | GENERATED | `GENERATED ALWAYS AS (total_harga - dp_dibayar) STORED`. JANGAN ditulis |
| `catatan` | TEXT | ya | – | Juga dipakai untuk riwayat `[Update: ...]` |
| `pilihan_background` | TEXT[] | ya | – | Nama warna background |
| `bukti_transfer` | TEXT | ya | – | Path file di bucket `bukti-transfer` (data lama) |
| `status` | `booking_status` | NOT NULL | `'pending'` | |
| `status_cetak` | TEXT (atau enum `cetak_status`, lihat catatan) | ya | `NULL` | (005) NULL = tanpa cetak. CHECK `bookings_status_cetak_check`: NULL atau `'menunggu'`/`'proses'`/`'selesai'` (NOT VALID, hanya berlaku untuk data baru) |
| `created_at` | TIMESTAMPTZ | ya | `NOW()` | |
| `updated_at` | TIMESTAMPTZ | ya | `NOW()` | Diperbarui trigger `bookings_updated_at` |

Catatan `status_cetak`: kolom ini tidak ada di 001–004. Kode web sudah memakainya sebelum 005, jadi kemungkinan pernah dibuat manual di dashboard Supabase. Migrasi 005 memakai `ADD COLUMN IF NOT EXISTS`, sehingga tipe kolom di produksi bisa TEXT, enum `cetak_status`, atau tipe lain. Nilainya tetap salah satu dari tiga string di atas atau NULL.

#### 1.2.7 `booking_addons`
| Kolom | Tipe | Null | Default | Keterangan |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `booking_id` | UUID | NOT NULL | – | FK → `bookings(id)` ON DELETE CASCADE |
| `addon_id` | UUID | ya | – | FK → `addons(id)` (tanpa ON DELETE) |
| `jenis` | `addon_jenis` | NOT NULL | – | Salinan |
| `nama` | TEXT | NOT NULL | – | Salinan |
| `satuan` | TEXT | NOT NULL | – | Salinan |
| `harga` | INT | NOT NULL | – | Salinan harga per unit saat ditambahkan |
| `jumlah` | INT | NOT NULL | `1` | |
| `total` | INT | – | GENERATED | `GENERATED ALWAYS AS (harga * jumlah) STORED`. JANGAN ditulis |
| `menit_per_unit` | INT | ya | NULL (versi lama 005: `15`) | (005) Salinan menit saat ditambahkan. NULL pada data lama → dibaca 15 |
| `ditambah_oleh_admin` | BOOLEAN | NOT NULL | `FALSE` | (005) TRUE = ditambah admin di lapangan |
| `ditambah_pada` | TIMESTAMPTZ | ya | NULL | (005) Waktu terakhir jumlah dinaikkan oleh admin |

#### 1.2.8 `booking_status_log`
| Kolom | Tipe | Null | Default | Keterangan |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | PK |
| `booking_id` | UUID | NOT NULL | – | FK → `bookings(id)` ON DELETE CASCADE |
| `status_dari` | `booking_status` | ya | – | |
| `status_ke` | `booking_status` | **NOT NULL** | – | Insert dengan nilai NULL GAGAL (lihat Bagian 7) |
| `catatan` | TEXT | ya | – | |
| `oleh` | TEXT | ya | – | Email admin atau `'system'` |
| `created_at` | TIMESTAMPTZ | ya | `NOW()` | |

#### 1.2.9 `waiting_list`
| Kolom | Tipe | Null | Default | Sumber | Keterangan |
|---|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | 001 | PK |
| `nama` | TEXT | NOT NULL | – | 001 | |
| `wa` | TEXT | NOT NULL | – | 001 | |
| `category_id` | UUID | ya | – | 001 | FK → `categories(id)` |
| `category_nama` | TEXT | NOT NULL | – | 001 | |
| `tanggal_ingin` | DATE | ya | – | 001 | Mode lama (per tanggal) |
| `catatan` | TEXT | ya | – | 001 | **Berisi data terstruktur** (jam, DP, kampus, paket, kode booking). Lihat 3.10 |
| `sudah_dihubungi` | BOOLEAN | NOT NULL | `FALSE` | 001 | |
| `created_at` | TIMESTAMPTZ | ya | `NOW()` | 001 | |
| `jam_ingin` | TIME | ya | – | 002 | TIDAK ditulis oleh kode. Jam disimpan di `catatan` |
| `kampus` | TEXT | ya | – | 002 | TIDAK ditulis oleh kode. Kampus disimpan di `catatan` |
| `dp_dibayar` | INT | ya | `100000` | 002 | TIDAK ditulis oleh kode, selalu bernilai default |
| `acara_id` | UUID | ya | – | 003 | FK → `wisuda_events(id)` ON DELETE SET NULL |
| `acara_nama` | TEXT | ya | – | 003 | Salinan nama acara |
| `package_nama` | TEXT | ya | – | 003 | Nama paket pilihan klien (teks, bukan FK) |

Index: `idx_waiting_list_acara_id` pada `acara_id`.

#### 1.2.10 `wisuda_events`
| Kolom | Tipe | Null | Default | Keterangan |
|---|---|---|---|---|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK |
| `nama` | TEXT | NOT NULL | – | cth. "Wisuda UNTAN Oktober 2026" |
| `kampus` | TEXT | NOT NULL | – | |
| `keterangan` | TEXT | ya | – | |
| `aktif` | BOOLEAN | NOT NULL | `TRUE` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | |

Index: `idx_wisuda_events_aktif`.

### 1.3 Trigger dan Fungsi Postgres

| Nama | Jenis | Logika | Sumber |
|---|---|---|---|
| `set_updated_at()` | Fungsi trigger | `NEW.updated_at = NOW()` | 001 |
| `bookings_updated_at` | Trigger BEFORE UPDATE ON `bookings` | Memanggil `set_updated_at()` | 001 |
| `settings_updated_at` | Trigger BEFORE UPDATE ON `settings` | Memanggil `set_updated_at()` | 001 |
| `generate_kode_booking()` | Fungsi trigger | Lihat penjelasan di bawah tabel | 001, versi final di 004 |
| `bookings_kode` | Trigger BEFORE INSERT ON `bookings` | Memanggil `generate_kode_booking()` | 004 |
| `is_admin()` | Fungsi `SECURITY DEFINER` | `RETURN auth.role() = 'authenticated'` | 001 |
| `terapkan_addon_lapangan(...)` | Fungsi RPC `SECURITY INVOKER` | Lihat 2.4 | 005 |

Logika `generate_kode_booking()`:
1. Jika `NEW.kode` tidak NULL dan tidak kosong (setelah TRIM), kode dibiarkan.
2. Jika kosong, `tgl = TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta','YYYYMMDD')` dan `prefix = 'DSR-' || tgl || '-'`.
3. `max_seq` = nilai MAX dari angka setelah prefix, pada semua kode yang cocok dengan regex `^prefix[0-9]+$` (0 jika belum ada).
4. `seq = max_seq + 1`. Kandidat kode = `prefix || LPAD(seq,3,'0')`, contoh `DSR-20261009-001`.
5. Selama kandidat sudah ada, `seq` dinaikkan.

Tanggal pada kode adalah tanggal saat booking DIBUAT (WIB), bukan tanggal sesi foto. Untuk memicu trigger, web mengirim `kode: ''`.

### 1.4 Kebijakan RLS per tabel

Semua tabel di bawah memiliki RLS aktif. Istilah:
- "anon" = request dengan anon key tanpa login.
- "admin" = `is_admin()` bernilai TRUE, yaitu setiap user yang sudah login.
- `service_role` selalu melewati RLS.

| Tabel | SELECT | INSERT | UPDATE | DELETE | Nama policy (sumber) |
|---|---|---|---|---|---|
| `settings` | Semua orang, kecuali baris `key = 'admin_email'` | admin | admin | admin | `settings_public_read`, `settings_admin_write` (001) |
| `categories` | Semua orang | admin | admin | admin | `categories_public_read`, `categories_admin_write` (001) |
| `packages` | Semua orang | admin | admin | admin | `packages_public_read`, `packages_admin_write` (001) |
| `addons` | Semua orang | admin | admin | admin | `addons_public_read`, `addons_admin_write` (001) |
| `addon_categories` | Semua orang | admin | admin | admin | `addon_categories_public_read`, `addon_categories_admin_write` (001) |
| `bookings` | admin | Semua orang (`WITH CHECK (TRUE)`) | admin | admin | `bookings_insert_anon`, `bookings_admin_all` (001) |
| `booking_addons` | admin | Semua orang, HANYA jika `ditambah_oleh_admin = FALSE AND ditambah_pada IS NULL` (005). Admin bebas | admin | admin | `booking_addons_insert_anon` (diganti di 005), `booking_addons_admin_all` (001) |
| `booking_status_log` | admin | Semua orang (`WITH CHECK (TRUE)`) | admin | admin | `booking_status_log_insert`, `_admin_read`, `_admin_update`, `_admin_delete` (001) |
| `waiting_list` | admin | Semua orang | admin | admin | `waiting_list_insert_anon`, `waiting_list_admin_all` (001) |
| `wisuda_events` | Semua orang | **TIDAK ADA policy** (ditolak untuk anon dan admin) | **ditolak** | **ditolak** | `wisuda_events_public_read` (003). Penulisan web hanya lewat service role |

Hak eksekusi fungsi `terapkan_addon_lapangan`: REVOKE dari `PUBLIC` dan `anon`, GRANT ke `authenticated` (005).

### 1.5 Storage bucket

| Bucket | Publik? | Policy | Dipakai oleh |
|---|---|---|---|
| `bukti-transfer` | Privat (`public = FALSE`, 001) | `allow_anon_upload`: INSERT ke `storage.objects` jika `bucket_id = 'bukti-transfer'` (semua orang). `allow_admin_read`: SELECT jika `bucket_id = 'bukti-transfer' AND is_admin()`. **Tidak ada policy DELETE** | `actions.ts › getBuktiTransferSignedUrl` (signed URL 3600 detik), `actions.ts › deleteBooking` (hapus file). Form klien saat ini TIDAK mengunggah bukti; bukti dikirim lewat WhatsApp. Kolom ini hanya terisi pada data lama |
| `backgrounds` | **TIDAK JELAS** (tidak ada di migrasi). Kode memakai `getPublicUrl`, jadi kemungkinan publik | **TIDAK JELAS** | `actions.ts › uploadBackgroundImage` |

Admin bisa membuat signed URL bukti transfer dengan sesi login biasa, karena pembuatan signed URL membutuhkan SELECT dan `allow_admin_read` mengizinkan `is_admin()`. Web saat ini membuatnya dengan service role.

### 1.6 Kunci tabel `settings`

Sumber: `supabase/seed.sql`, `src/types/index.ts › Settings`, `src/app/page.tsx › defaultSettings`, `SettingsClient.tsx`.

| key | Bentuk JSON `value` | Contoh | Diubah di admin? | Default di kode jika kosong |
|---|---|---|---|---|
| `nama_studio` | string | `"Desara Home Studio"` | Ya | `'Desara Home Studio'` |
| `wa_admin` | string angka berawalan 62 | `"6281234567890"` | Ya (hint "Format: 628xxxxxxxxxx") | `'6281234567890'` |
| `rekening_bni` | string | `"1234567890"` | Ya | `'1234567890'` |
| `rekening_bri` | string | (lama) | Tidak | Dipakai sebagai fallback jika `rekening_bni` kosong |
| `nama_rekening` | string | `"Desara Studio"` | Ya | `'Desara Studio'` |
| `dp_minimal` | number | `100000` | Ya | `100000` |
| `teks_sambutan` | string | `"Selamat datang di ..."` | Ya | (lihat `page.tsx`) |
| `tampilkan_waiting` | boolean | `true` | **Tidak ada UI** | `true` |
| `jam_buka` | string `"HH:MM"` | `"08:00"` | Ya (input time) | `'08:00'` |
| `jam_tutup` | string `"HH:MM"` | `"20:00"` | Ya (input time) | `'20:00'` |
| `slot_interval` | number (menit) | `30` | Ya | `30` |
| `backgrounds` | array berisi string ATAU objek `{ "nama": string, "image_url"?: string, "id"?: string }` | `[{"nama":"Putih Bersih","image_url":"https://..."}]` | Ya | 10 nama warna di `page.tsx` |
| `closed_dates` | array `{ "tanggal": "YYYY-MM-DD", "keterangan": string }`, diurutkan menaik | `[{"tanggal":"2026-12-25","keterangan":"Libur Natal"}]` | Ya | `[]` |
| `max_booking_per_slot` | number | – | Tidak | Hanya ada di tipe TS, tidak dibaca kode |
| `admin_email` | – | – | Tidak | Disembunyikan oleh RLS. Tidak dipakai kode. **TIDAK JELAS** apakah ada di DB |

Penulisan web: `actions.ts › updateSetting(key, value)` melakukan `upsert({ key, value })` dengan service role. Nilai disimpan sebagai JSON apa adanya (string tetap string, number tetap number).

### 1.7 Cara sistem mengenali admin

- Tidak ada tabel role, tidak ada custom claim. `is_admin()` = `auth.role() = 'authenticated'`, artinya **setiap user Supabase Auth yang berhasil login dianggap admin**.
- Halaman `/admin/*` dijaga oleh `src/middleware.ts` (redirect ke `/admin/login` jika `supabase.auth.getUser()` kosong) dan oleh `src/app/admin/(dashboard)/layout.tsx`.
- **TIDAK JELAS**: apakah pendaftaran user publik (sign-up) di proyek Supabase dimatikan. Jika aktif, siapa pun bisa mendaftar dan menjadi "admin". Cek di Supabase Dashboard › Authentication › Providers/Settings.

---

## BAGIAN 2 — LETAK LOGIKA DAN RENCANA RPC

### 2.1 Gambaran klien Supabase di web

| Klien | File | Kunci | RLS? | Dipakai untuk |
|---|---|---|---|---|
| `createClient()` (browser) | `src/lib/supabase/client.ts` | anon key + sesi login | Berlaku | Login, CRUD langsung di `PackagesClient`, `AddonsClient`, logout di `AdminNav` |
| `createClient()` (server) | `src/lib/supabase/server.ts` | anon key + cookie sesi | Berlaku | Membaca data di halaman admin (`page.tsx`), `requireAdmin()`, add-on di lapangan |
| `createAdminClient()` | `src/lib/supabase/server.ts` | **service role key** | **Dilewati** | Hampir semua Server Action di `actions.ts` |

Klasifikasi pada tabel di bawah:
- **(a)** = Android cukup memakai query Supabase langsung (anon key + login admin, dilindungi RLS).
- **(b)** = sebaiknya dijadikan Postgres RPC atau Edge Function bersama, agar web dan Android memakai logika yang sama.

### 2.2 Fungsi di `src/app/actions.ts`

Semua fungsi `export async` adalah Server Action. Kolom "Klien DB" menunjukkan klien yang dipakai. SR = service role.

#### `checkIsDateClosed(supabase, tanggal)` — helper internal
- Tujuan: mengecek apakah tanggal ditutup admin.
- Logika: membaca `settings` dengan `key='closed_dates'`. Jika `value` berupa array, cari item dengan `tanggal === tanggal`. Hasilnya item tersebut atau `null`. Jika error, hasilnya `null`.
- Dipakai oleh: `submitBooking`, `submitWaitingList`, `getWaitingListSlotStatus`, `convertWaitingListToBooking`, `getAvailableSlots`.
- Klasifikasi: (a). Baca `settings` lalu cocokkan di aplikasi.

#### `requireAdmin()` — helper internal
- Logika: `createClient()` (sesi cookie), lalu `auth.getUser()`. Jika tidak ada user, hasilnya `{ error: 'Sesi admin tidak valid. Silakan login ulang.' }`. Jika ada, hasilnya `{ supabase, email }`.
- Hanya dipakai oleh `addAddonsToBooking` dan `kurangiAddonLapangan`.

#### `submitBooking(formData: BookingFormData)` — Publik, SR
- Hasil: `{ success: true, booking }` atau `{ error }`.
- Langkah:
  1. `checkIsDateClosed`. Jika tutup → error `Studio tutup pada tanggal {tanggal}{ (keterangan)}. Silakan pilih tanggal lain.`
  2. Ambil `packages` dengan `id = formData.package.id` dan `aktif = true`. Jika tidak ada atau `category_id` berbeda dari `formData.category.id` → error `Paket tidak ditemukan atau sudah tidak aktif. Silakan muat ulang halaman.` Harga dan durasi paket dari browser TIDAK dipakai.
  3. Ambil `categories.nama`.
  4. Ambil add-on yang dikirim (hanya `jumlah > 0`) dari tabel `addons`, beserta `addon_categories` untuk kategori paket. Setiap add-on harus ada di DB dan aktif untuk kategori tersebut. Jika tidak → error `Ada add-on yang tidak tersedia untuk kategori ini. Silakan muat ulang halaman.` Jumlah harus bilangan bulat `1..maks`; jika tidak → error `Jumlah add-on "{nama}" tidak valid (maksimal {maks}).`
  5. `durasiTotal = pkg.durasi_menit + hitungMenitAddon(addonRows)` (lihat 3.2).
  6. Baca `jam_buka` dan `jam_tutup` (default `'08:00'`/`'20:00'`). Jika `!isSlotWithinOperatingHours(jam_mulai, durasiTotal, jamBuka, jamTutup)` → error `Waktu sesi ({jam} WIB dengan durasi {n} menit) berada di luar jam operasional atau melewati jam tutup studio ({buka} - {tutup}).`
  7. Ambil booking di tanggal itu dengan status `pending`/`booking`. Jika `isSlotBlocked(...)` → error `Slot jam sudah dipesan. Pilih jam lain.`
  8. `totalHarga = pkg.harga + hitungHargaAddon(addonRows)`.
  9. `hasCetak = paketPunyaCetak(pkg) || ada add-on jenis cetak`.
  10. INSERT ke `bookings` dengan: `kode ''`, `status 'pending'`, `status_cetak = hasCetak ? 'menunggu' : null`, `package_snapshot` = baris paket dari DB, `dp_dibayar = formData.dp_dibayar` (**TIDAK divalidasi di server**), `bukti_transfer = formData.bukti_transfer || null`.
  11. INSERT ke `booking_addons` untuk tiap add-on. Untuk `jenis='waktu'`: `satuan = "+{menit} menit"` dan `menit_per_unit = getMenitPerUnit`. Selain waktu: `menit_per_unit = null`. Semua baris `ditambah_oleh_admin = false`.
  12. INSERT ke `booking_status_log` dengan `status_dari null`, `status_ke 'pending'`, `oleh 'system'`, `catatan 'Booking dibuat oleh klien'`.
- Transaksi: TIDAK. Ada 3 penulisan terpisah, dan error insert add-on serta log tidak dicek.
- Klasifikasi: (b) jika suatu saat Android membuat booking. Saat ini Android (admin) tidak memerlukannya.

#### `submitWaitingList(data)` — Publik, SR
- Parameter: `nama`, `wa`, `category_id`, `category_nama`, `package_nama?`, `kampus?`, `acara_id?`, `acara_nama?`, `tanggal_ingin?`, `jam_ingin` (wajib), `catatan?`, `dp_minimal?`.
- Langkah:
  1. Jika `jam_ingin` kosong → error `Jam sesi waiting list wajib dipilih.`
  2. Mode acara (`acara_id` ada): jika ada waiting list dengan `acara_id` sama yang `parseWaitingListInfo(catatan).jam === jam_ingin` → error `Jam {jam} WIB untuk acara ini sudah dipilih client lain dari acara yang sama. Silakan pilih jam lain.`
  3. Mode tanggal (`tanggal_ingin` ada):
     - Tanggal tutup → error.
     - Jam sudah dipakai waiting list lain di tanggal sama → error `Jam {jam} WIB pada tanggal ini sudah dipilih oleh client waiting list lain. Silakan pilih jam lain.`
     - `isSlotBlocked(jam, 30, booking aktif)` → error `Jam {jam} WIB pada tanggal ini sudah dipesan (booking). Silakan pilih jam lain.`
  4. Jika tidak keduanya → error `Pilih acara wisuda atau tanggal sesi foto.`
  5. `dpAmount = data.dp_minimal || 100000`.
  6. Susun `catatan` (lihat 3.10).
  7. INSERT ke `waiting_list` dengan `sudah_dihubungi=false`.
- Klasifikasi: tidak dibutuhkan Android.

#### `getWaitingListSlotStatus(tanggal, jamBuka='08:00', jamTutup='20:00', interval=30)` — Publik (mode lama), SR
- Hasil: `{ allSlots, bookedSlots, waitingListSlots }`. Jika tanggal tutup atau terjadi error, semuanya array kosong.
- `allSlots = generateTimeSlots(jamBuka, jamTutup, interval)`.
- `bookedSlots` = slot yang memenuhi `isSlotBlocked(slot, interval, booking aktif)`.
- `waitingListSlots` = jam unik dari `catatan` waiting list di tanggal itu.
- Klasifikasi: tidak dibutuhkan Android.

#### `getWisudaSlotStatus(acaraId, jamBuka, jamTutup, interval)` — Publik, SR
- Hasil: `{ allSlots, takenSlots }`. `takenSlots` = jam unik dari `catatan` waiting list dengan `acara_id` sama, yang termasuk dalam `allSlots`.
- Inilah "kunci slot wisuda": satu jam per acara hanya boleh dipakai satu klien waiting list.
- Klasifikasi: (a) jika Android ingin menampilkan jam yang terpakai per acara.

#### `getWisudaEvents()` — Publik/Admin, SR
- SELECT `wisuda_events` urut `created_at` menurun. Hasil `{ events, error? }`.
- Klasifikasi: (a).

#### `createWisudaEvent({ nama, kampus, keterangan?, aktif? })` — Admin, SR
- INSERT dengan nilai di-trim; `keterangan` kosong → null; `aktif` = `data.aktif !== false`.
- TIDAK cek login (lihat Bagian 7).
- Klasifikasi: (b). Bisa juga (a) jika ditambah policy RLS INSERT/UPDATE/DELETE untuk admin pada `wisuda_events`. Tanpa policy itu, **Android tidak bisa menulis tabel ini**.

#### `updateWisudaEvent(id, { nama?, kampus?, keterangan?, aktif? })` — Admin, SR
- Hanya field yang dikirim yang di-update (trim; `keterangan` kosong → null). Klasifikasi sama dengan `createWisudaEvent`.

#### `deleteWisudaEvent(id)` — Admin, SR
- DELETE. Waiting list terkait tetap ada; `acara_id` menjadi NULL karena FK SET NULL. Klasifikasi sama.

#### `convertWaitingListToBooking(waitingListId, tanggalFoto, adminEmail?)` — Admin, SR
- Hasil: `{ success: true, bookingKode }` atau `{ error }`.
- Langkah:
  1. Ambil waiting list. Jika tidak ada → `Data waiting list tidak ditemukan.`
  2. Jika `tanggalFoto` kosong → `Tanggal foto wajib dipilih oleh admin.`
  3. Jika `parseWaitingListInfo(catatan).bookingKode` sudah ada → `Waiting list ini sudah pernah dikonversi ke booking dengan kode {kode}.`
  4. Tanggal tutup → `Studio tutup pada tanggal {tgl}{ (ket)}. Pilih tanggal lain.`
  5. Ambil paket aktif kategori itu, urut `urutan`. Pilih paket yang `nama` (huruf kecil) sama dengan `waiting_list.package_nama`. Jika tidak ada, ambil paket pertama. Jika kategori tanpa paket, pakai paket palsu: `id '00000000-0000-0000-0000-000000000000'`, `nama 'Paket Standard (Waiting List)'`, `harga 100000`, `durasi_menit 30`, `maks_orang 2`, `jumlah_pilihan_background 1`.
  6. `jam_mulai = parsedInfo.jam || '09:00'`, `durasi_total = pkg.durasi_menit || 30`, `dp_dibayar = 100000` (**hardcode, tidak membaca setting**), `total_harga = pkg.harga || 100000`.
  7. INSERT `bookings` dengan: status `'pending'`, `catatan = "[Dikonversi dari Waiting List] {catatan lama}"`, `pilihan_background []`, `bukti_transfer null`, `kampus = parsedInfo.kampus`, dan `status_cetak` TIDAK diisi (NULL walau paket punya cetak).
  8. INSERT log: `status_dari null`, `status_ke 'pending'`, `oleh = adminEmail || 'admin'`, catatan `Booking dibuat otomatis dari data Waiting List oleh admin`.
  9. UPDATE waiting list: `sudah_dihubungi = true`, `catatan = catatan + " [Sudah Masuk Booking: {kode}]"`.
- **Tidak mengecek bentrok slot, tidak mengecek jam operasional/jam tutup, dan tidak mengecek menit add-on** (waiting list tidak punya add-on).
- Transaksi: TIDAK.
- Klasifikasi: (b), RPC `konversi_waiting_list(...)`.

#### `getAvailableSlots(tanggal, durasiMenit=30, jamBuka='08:00', jamTutup='20:00', interval=30)` — Publik + Admin (Reschedule), SR
- Hasil: array `"HH:MM"`.
- Langkah:
  1. Jika tanggal tutup → `[]`.
  2. Ambil `jam_mulai` dan `durasi_total` booking di tanggal itu dengan status `pending`/`booking`.
  3. Mulai dari menit buka. Ulangi selama `cur + durasi <= menitTutup`, dengan langkah `cur += interval`. Slot dimasukkan jika `!isSlotBlocked(slot, durasi, bookings)`.
  4. Jika terjadi error, fallback: semua slot 08:00–20:00 per 30 menit tanpa cek booking.
- Klasifikasi: (b), RPC `get_available_slots`, agar web dan Android identik. Alternatifnya (a) dengan meniru algoritma 3.5 (admin boleh SELECT `bookings`).

#### `updateBookingStatus(bookingId, statusBaru, catatan?, adminEmail?)` — Admin, SR
- Transisi yang diizinkan (lihat 3.7). Jika tidak diizinkan → `Tidak bisa mengubah status dari {lama} ke {baru}.`
- UPDATE `status`, lalu INSERT log (`status_dari`, `status_ke`, `catatan || null`, `oleh = adminEmail || 'admin'`).
- Booking tidak ditemukan → `Booking tidak ditemukan.`
- Tidak cek login. Bukan transaksi.
- Klasifikasi: (b). Aturan transisi hanya ada di Server Action. Database tidak menolak transisi terlarang.

#### `updateBookingSchedule(bookingId, tanggal, jamMulai, adminEmail?, keterangan?, newPackageId?)` — Admin, SR
- Langkah:
  1. Ambil booking + `booking_addons`.
  2. Jika `newPackageId` berbeda dari `package_id`: ambil paket. Jika tidak ada → `Paket foto baru tidak ditemukan.` Lalu hitung:
     - `durasi_total = (pkg.durasi_menit || 30) + hitungMenitAddon(booking_addons)`
     - `total_harga = pkg.harga + Σ(a.total || a.harga*a.jumlah)`
     - Update juga `category_id`, `category_nama`, `package_id`, `package_nama`, `package_harga`, `package_snapshot` (tanpa relasi `categories`).
     - Catatan perubahan: `Paket diubah dari "{lama}" ke "{baru}" (Rp {harga})`.
  3. Jika tanggal atau jam berubah: cek `isSlotBlocked(jamMulai, durasi efektif, booking lain di tanggal itu dengan status pending/booking, kecuali booking ini)`. Jika bentrok → `Slot jam pada tanggal tersebut sudah dipesan. Pilih jam lain.` Catatan: `Jadwal: {tgl lama} {jam lama} ➔ {tgl} {jam}`.
  4. Jika ada keterangan: `Keterangan: {ket}`.
  5. Jika ada perubahan, `catatan += "\n[Update: {perubahan dipisah ' | '}]"`.
  6. UPDATE booking.
  7. INSERT log dengan `status_dari null`, **`status_ke null`** (insert ini GAGAL karena NOT NULL dan errornya tidak dicek, jadi log reschedule tidak pernah tersimpan).
- **Tidak mengecek** tanggal tutup, jam operasional/jam tutup, status booking, dan tidak mengubah `status_cetak` saat paket berganti.
- Klasifikasi: (b), RPC `ubah_jadwal_booking(...)`.

#### `markWaitingListContacted(id)` — Admin, SR
- UPDATE `sudah_dihubungi = true`. Klasifikasi: (a).

#### `updateSetting(key, value)` — Admin, SR
- UPSERT `settings`. Error tidak dicek. Klasifikasi: (a).

#### `uploadBackgroundImage(formData)` — Admin, SR
- Nama file `bg-{Date.now()}-{6 karakter acak}.{ext}`. Upload ke bucket `backgrounds` (`upsert true`, `cacheControl '3600'`). Hasil `{ success, url: publicUrl }`.
- Klasifikasi: (a) jika policy storage `backgrounds` mengizinkan INSERT untuk admin (**TIDAK JELAS**).

#### `getBuktiTransferSignedUrl(fileName)` — Admin, SR
- `createSignedUrl(fileName, 3600)` di bucket `bukti-transfer`. Hasil `{ url }` atau `{ error }`.
- Klasifikasi: (a).

#### `updateCetakStatus(bookingId, statusCetak, adminEmail?)` — Admin, SR
- UPDATE `status_cetak`, lalu INSERT log dengan **`status_ke null`** (gagal tanpa ketahuan, sama seperti di atas).
- Klasifikasi: (a).

#### `deleteBooking(bookingId)` — Admin, SR
- Jika `bukti_transfer` ada, hapus file dari bucket (error diabaikan). Lalu DELETE booking; `booking_addons` dan `booking_status_log` ikut terhapus (CASCADE).
- Klasifikasi: (a) untuk DELETE baris. Penghapusan file storage dengan sesi admin akan DITOLAK karena tidak ada policy DELETE (lihat 1.5).

#### `deleteWaitingList(id)` — Admin, SR
- DELETE. Klasifikasi: (a).

#### `addAddonsToBooking(bookingId, items, catatan?, backgroundsDipilih?, izinkanLewatJamTutup=false)` — Admin, **sesi admin (RLS)**
- Hasil: `{ success: true }` atau `{ error, perluKonfirmasiJamTutup? }`.
- Langkah:
  1. `requireAdmin()`.
  2. Ambil booking + `booking_addons`. Status harus `pending` atau `booking`. Jika tidak → `Add-on di lapangan hanya untuk booking berstatus Pending atau Booking. Status saat ini: {status}.`
  3. Ambil master `addons` (`id, jenis, nama, satuan, harga, maks, menit_per_unit`) untuk id yang dikirim, serta `addon_categories` untuk `booking.category_id`. Jika `category_id` NULL, add-on tidak dibatasi kategori.
  4. `rencanakanTambahAddon(...)` (lihat 3.8). Jika gagal, kembalikan pesan error-nya.
  5. Warna background tambahan: buang duplikat dan nama yang sudah ada di booking. Jumlahnya maksimal `rencana.tambahanBackground`; jika lebih → `Warna background tambahan maksimal {n}.` Jika ada warna baru, `pilihan_background` baru = lama + baru.
  6. Jika `deltaMenit > 0`: baca `jam_tutup` (default `'20:00'`). Jika `!isSlotWithinOperatingHours(jam_mulai[0..5], durasiBaru, '00:00', jamTutup)` dan `izinkanLewatJamTutup` false → error `Durasi baru ({n} menit) membuat sesi selesai melewati jam tutup {jamTutup}. Centang konfirmasi untuk tetap melanjutkan.` dengan `perluKonfirmasiJamTutup: true`.
  7. Teks log: `Add-on di lapangan: {rincian dipisah ', '} (+Rp {deltaHarga}[, +{deltaMenit} menit])`, lalu opsional `. Warna tambahan: ...`, `. Melewati jam tutup (disetujui admin)`, `. Catatan: {catatan}`.
  8. Panggil RPC `terapkan_addon_lapangan` (lihat 2.4).
- Klasifikasi: SEBAGIAN (b). Penulisan sudah RPC bersama, tetapi perencanaan (validasi maks, penggabungan, harga) masih di TypeScript. Android harus meniru `rencanakanTambahAddon` PERSIS, atau lebih baik perencanaan dipindah ke RPC (rekomendasi 2.5).

#### `kurangiAddonLapangan(bookingAddonId, jumlahKurang)` — Admin, sesi admin (RLS)
- Langkah:
  1. `requireAdmin()`.
  2. Ambil baris `booking_addons` (tidak ada → `Data add-on tidak ditemukan.`) dan booking-nya (tidak ada → `Booking terkait tidak ditemukan.`). Status harus `pending`/`booking`, jika tidak → `Add-on tidak bisa diubah untuk booking berstatus {status}.`
  3. `rencanakanKurangiAddon(row, jumlahKurang)`.
  4. Teks log: `Koreksi add-on di lapangan: {nama} -{k} (sisa {n} | dihapus) (-Rp {x}[, -{m} menit])`.
  5. RPC `terapkan_addon_lapangan`.
- Klasifikasi: sama seperti di atas.

### 2.3 Fungsi di `src/lib/utils.ts` dan `src/lib/addon-calc.ts`

| Fungsi | Parameter → Hasil | Logika persis |
|---|---|---|
| `cn(...)` | kelas CSS | Hanya untuk UI, abaikan |
| `formatRupiah(n)` | number → string | `Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0})`. Contoh `345000` → `"Rp 345.000"`, dengan **karakter U+00A0 (no-break space)** setelah "Rp" |
| `generateTimeSlots(jamBuka, jamTutup, interval)` | → string[] | `for t = buka; t < tutup; t += interval`. Format `HH:MM`. TIDAK memperhitungkan durasi (beda dengan `getAvailableSlots`) |
| `timeToMinutes("HH:MM[:SS]")` | → number | `h*60 + m`, detik diabaikan |
| `minutesToTime(n)` | → `"HH:MM"` | Tidak wrap 24 jam (1500 → `"25:00"`) |
| `normalizeTime(t)` | → `"HH:MM"` | Ambil dua bagian pertama, pad 2 digit. `"9:0"` → `"09:00"`, `"13:00:00"` → `"13:00"`. Input kosong → `''` |
| `countBookingsForSlot(slot, bookings)` | → number | Jumlah booking dengan `normalizeTime(jam_mulai) === normalizeTime(slot)` |
| `isSlotBlocked(slot, durasi, bookings, maxCapacity=MAX_BOOKING_PER_SLOT)` | → boolean | `countBookingsForSlot >= capacity`. **Durasi diabaikan.** Ada bentuk lain `(slot, bookings, capacity)` |
| `MAX_BOOKING_PER_SLOT` | konstanta | `Number(env.MAX_BOOKING_PER_SLOT \|\| env.NEXT_PUBLIC_MAX_BOOKING_PER_SLOT) \|\| 1` |
| `isSlotExceedingClosingTime(slot, durasi, jamTutup='20:00')` | → boolean | `start + durasi > tutup`. Tidak dipakai di luar test |
| `isSlotWithinOperatingHours(slot, durasi, jamBuka='08:00', jamTutup='20:00')` | → boolean | `start >= buka && start + durasi <= tutup` (selesai TEPAT jam tutup = boleh) |
| `buildWAMessage({...})` | → string ter-encode URI | Pesan konfirmasi klien di langkah sukses (publik) |
| `parseWaitingListInfo(catatan)` | → `{ jam?, kampus?, dp?, bookingKode?, catatanTambahan? }` | Regex, lihat 3.10 |
| `DEFAULT_MENIT_PER_UNIT` | 15 | `addon-calc.ts` |
| `getMenitPerUnit(a)` | → number | Jika `jenis !== 'waktu'` → 0. Selain itu: jika `menit_per_unit` bilangan bulat > 0, pakai nilai itu; jika tidak (null, 0, desimal) → 15 |
| `labelSatuanWaktu(a)` | → `"+{menit} menit"` | Memakai `getMenitPerUnit` dengan jenis dipaksa `'waktu'` |
| `hitungMenitAddon(rows)` | → number | Σ `getMenitPerUnit(r) * jumlah` |
| `hitungHargaAddon(rows)` | → number | Σ `harga * jumlah` |
| `jumlahTerpakai(rows, addonId)` | → number | Σ `jumlah` untuk baris dengan `addon_id` sama (pesanan awal + tambahan admin) |
| `sisaKuota(maks, rows, addonId)` | → number | `max(0, maks - jumlahTerpakai)` |
| `rencanakanTambahAddon(existing, masters, items, allowedIds)` | → `{ok, rencana}` / `{ok:false, error}` | Lihat 3.8 |
| `rencanakanKurangiAddon(row, k)` | → sama | Lihat 3.8 |
| `paketPunyaCetak(pkg)` | → boolean | `cetak_ukuran` terisi ATAU `cetak_jumlah > 0` |
| `tentukanAksiCetak({...})` | → `'menunggu'\|'kosongkan'\|'tetap'` | Lihat 3.7 |
| `terapkanRencanaKeBaris(existing, rencana)` | → baris baru | Untuk pratinjau dan perhitungan status cetak |
| `ringkasanSetelah(booking, dHarga, dMenit)` | → `{totalBaru, dp, sisaBaru, durasiBaru}` | `totalBaru = max(0, total + dHarga)`, `durasiBaru = max(1, durasi + dMenit)`, `sisaBaru = totalBaru - dp` |

### 2.4 Fungsi RPC `terapkan_addon_lapangan` (005)

Parameter:
- `p_booking_id` UUID
- `p_expected_updated_at` TIMESTAMPTZ (nilai `bookings.updated_at` yang dibaca sebelumnya; NULL = lewati cek)
- `p_update_rows` JSONB, berbentuk `[{"id":uuid,"jumlah":int}]` (jumlah ≤ 0 = hapus)
- `p_insert_rows` JSONB, berbentuk `[{"addon_id","jenis","nama","satuan","harga","jumlah","menit_per_unit"}]`
- `p_delta_harga` INT
- `p_delta_menit` INT
- `p_cetak_aksi` TEXT (`'tetap'|'menunggu'|'kosongkan'`)
- `p_pilihan_background` TEXT[] (NULL = tidak berubah)
- `p_log` TEXT
- `p_oleh` TEXT

Urutan kerja (semuanya dalam SATU transaksi):
1. Jika `is_admin()` false → error `Akses ditolak: hanya admin yang sudah login.` (ERRCODE 42501).
2. `SELECT ... FOR UPDATE` booking. Tidak ada → `Booking tidak ditemukan.`
3. Status bukan `pending`/`booking` → `Add-on di lapangan hanya untuk booking berstatus pending atau booking (status sekarang: %).`
4. Jika `updated_at` berbeda dari yang diharapkan → `Data booking baru saja berubah. Muat ulang halaman lalu coba lagi.`
5. Untuk tiap `p_update_rows`: DELETE atau UPDATE `jumlah`, HANYA untuk baris dengan `booking_id` cocok dan `ditambah_oleh_admin = TRUE`. `ditambah_pada = NOW()` hanya jika jumlah naik. Jika 0 baris kena → `Baris add-on tidak ditemukan atau bukan tambahan di lapangan.`
6. INSERT `p_insert_rows` dengan `ditambah_oleh_admin = TRUE` dan `ditambah_pada = NOW()`.
7. UPDATE booking:
   - `total_harga = GREATEST(0, total_harga + p_delta_harga)`
   - `durasi_total = GREATEST(1, durasi_total + p_delta_menit)`
   - `pilihan_background = COALESCE(p_pilihan_background, pilihan_background)`
   - `status_cetak`: `'menunggu'` jika aksi `menunggu`, NULL jika `kosongkan`, tidak berubah jika `tetap`.
8. INSERT log dengan `status_dari = status_ke = status booking`, `oleh = COALESCE(email dari JWT, p_oleh, 'admin')`.
9. Hasil: `{"total_harga","durasi_total","sisa_pelunasan"}`.

Catatan penting: RPC ini **percaya** pada `p_delta_harga`, `p_delta_menit`, dan isi baris yang dikirim. Validasi harga dan maks ada di TypeScript (`addon-calc.ts`). Android yang memanggil RPC ini wajib menghitung dengan rumus 3.8 yang sama persis.

### 2.5 Rekomendasi RPC bersama & kecukupan RLS untuk Android

Kecukupan RLS untuk Android (anon key + login admin):
- **Cukup** untuk: membaca semua tabel, CRUD `categories`/`packages`/`addons`/`addon_categories`/`settings`, update/delete `bookings`, `waiting_list`, `booking_addons`, insert `booking_status_log`, signed URL `bukti-transfer`, dan memanggil `terapkan_addon_lapangan`.
- **Tidak cukup** untuk:
  - menulis `wisuda_events` (tidak ada policy tulis);
  - menghapus file di `bukti-transfer` (tidak ada policy DELETE);
  - upload ke `backgrounds` (policy **TIDAK JELAS**).
- **Celah umum**: semua user login adalah admin (lihat 1.7).

Rekomendasi RPC bersama, urut prioritas:
1. `ubah_status_booking(booking_id, status_baru, catatan)`: menegakkan transisi 3.7 dan menulis log dalam satu transaksi.
2. `get_available_slots(tanggal, durasi)`: membaca `jam_buka`/`jam_tutup`/`slot_interval`/`closed_dates` dari `settings` di dalam fungsi (web Reschedule saat ini memakai hardcode 08:00/20:00/30).
3. `ubah_jadwal_booking(booking_id, tanggal, jam, package_id, keterangan)`: termasuk cek tanggal tutup dan jam operasional, serta log yang benar (`status_ke` = status saat ini).
4. `tambah_addon_lapangan(booking_id, items jsonb, catatan, backgrounds, izinkan_lewat_jam_tutup)` dan `kurangi_addon_lapangan(booking_addon_id, jumlah)`: memindahkan `rencanakanTambahAddon`/`rencanakanKurangiAddon` ke SQL, sehingga Android tidak perlu meniru rumus TypeScript.
5. `konversi_waiting_list(waiting_list_id, tanggal)`.
6. `ubah_status_cetak(booking_id, status)`: termasuk log yang benar.
7. Policy RLS tulis untuk `wisuda_events` (`FOR ALL USING (is_admin()) WITH CHECK (is_admin())`), atau RPC CRUD acara.

### 2.6 Daftar RPC yang direkomendasikan (untuk "Prompt Web" tahap berikutnya)

Konvensi yang diusulkan untuk SEMUA RPC baru:
- Bahasa: `plpgsql`, `SECURITY INVOKER` (RLS tetap berlaku). Kecuali `get_available_slots`: `SECURITY DEFINER` dengan `SET search_path = public`, karena web publik juga memakainya dan anon tidak boleh membaca `bookings`.
- Baris pertama: `IF NOT is_admin() THEN RAISE EXCEPTION 'AKSES_DITOLAK: ...' USING ERRCODE = '42501'`. Tidak berlaku untuk RPC publik.
- Error dikirim dengan `RAISE EXCEPTION '<KODE>: <pesan Indonesia>'`. Android dan web cukup membaca awalan `<KODE>` sebelum titik dua untuk menentukan tindakan, lalu menampilkan pesannya ke admin.
- Setiap RPC yang mengubah booking menulis `booking_status_log` dengan `status_ke` = status booking saat itu (JANGAN NULL) dan `oleh = COALESCE(auth.jwt()->>'email','admin')`.
- `REVOKE ALL ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated` (kecuali RPC publik).

Kode error bersama:

| Kode | Arti |
|---|---|
| `AKSES_DITOLAK` | Tidak login sebagai admin |
| `BOOKING_TIDAK_DITEMUKAN` | `id` booking tidak ada |
| `DATA_BERUBAH` | `updated_at` berbeda dari yang dikirim (data diubah orang lain); muat ulang |
| `STATUS_TIDAK_DIIZINKAN` | Status booking tidak cocok untuk aksi ini |
| `TRANSISI_DITOLAK` | Transisi status terlarang (tabel 3.7) |
| `SLOT_BENTROK` | Jam mulai sudah dipakai booking aktif lain (aturan 3.5) |
| `TANGGAL_TUTUP` | Tanggal ada di `settings.closed_dates` |
| `DI_LUAR_JAM_OPERASIONAL` | `jam_mulai < jam_buka` atau `jam_mulai + durasi > jam_tutup` |
| `LEWAT_JAM_TUTUP` | Add-on di lapangan membuat sesi melewati jam tutup dan belum dikonfirmasi |
| `PAKET_TIDAK_DITEMUKAN` | Paket tidak ada / tidak aktif |
| `ADDON_TIDAK_DITEMUKAN` | Add-on tidak ada |
| `ADDON_BUKAN_KATEGORI` | Add-on tidak aktif untuk kategori booking |
| `MELEBIHI_MAKS` | Jumlah lama + baru > `addons.maks` |
| `JUMLAH_TIDAK_VALID` | Jumlah bukan bilangan bulat positif / di luar batas |
| `ITEM_KOSONG` | Tidak ada item dengan jumlah > 0 |
| `BUKAN_TAMBAHAN_ADMIN` | Mencoba mengubah add-on pesanan awal klien |
| `BACKGROUND_MELEBIHI_KUOTA` | Warna tambahan > unit add-on background yang ditambah |
| `STATUS_CETAK_TIDAK_VALID` | Bukan `menunggu`/`proses`/`selesai`/NULL |
| `WAITING_LIST_TIDAK_DITEMUKAN` | |
| `SUDAH_DIKONVERSI` | Waiting list sudah punya `[Sudah Masuk Booking: ...]` |
| `TANGGAL_KOSONG` | Tanggal wajib diisi |

Daftar RPC. Status: **ADA** = sudah ada di migrasi; **BELUM** = perlu dibuat.

| # | Nama | Status | Parameter | Nilai kembalian | Kode error | Menggantikan |
|---|---|---|---|---|---|---|
| R0 | `terapkan_addon_lapangan` | **ADA** (005, jika sudah dijalankan) | lihat 2.4 | `{total_harga, durasi_total, sisa_pelunasan}` | Pesan teks tanpa kode (lihat 2.4) | Bagian penulisan `addAddonsToBooking`/`kurangiAddonLapangan` |
| R1 | `ubah_status_booking` | BELUM | `p_booking_id uuid`, `p_status_baru booking_status`, `p_catatan text DEFAULT NULL` | `{id, status_dari, status_ke}` | `AKSES_DITOLAK`, `BOOKING_TIDAK_DITEMUKAN`, `TRANSISI_DITOLAK` | `updateBookingStatus` |
| R2 | `ubah_status_cetak` | BELUM | `p_booking_id uuid`, `p_status_cetak text` (NULL = reset) | `{status_cetak}` | `AKSES_DITOLAK`, `BOOKING_TIDAK_DITEMUKAN`, `STATUS_CETAK_TIDAK_VALID` | `updateCetakStatus` (+ perbaikan log) |
| R3 | `get_available_slots` | BELUM | `p_tanggal date`, `p_durasi int`, `p_kecuali_booking_id uuid DEFAULT NULL` | `text[]` berisi `"HH:MM"` (kosong jika tanggal tutup) | – | `getAvailableSlots`. Membaca `jam_buka`, `jam_tutup`, `slot_interval`, `closed_dates` dari `settings`; kapasitas 1 |
| R4 | `ubah_jadwal_booking` | BELUM | `p_booking_id uuid`, `p_tanggal date`, `p_jam_mulai time`, `p_package_id uuid DEFAULT NULL`, `p_keterangan text DEFAULT NULL`, `p_expected_updated_at timestamptz DEFAULT NULL` | `{total_harga, durasi_total, sisa_pelunasan, catatan}` | `AKSES_DITOLAK`, `BOOKING_TIDAK_DITEMUKAN`, `PAKET_TIDAK_DITEMUKAN`, `SLOT_BENTROK`, `DATA_BERUBAH`. Opsional (perilaku BARU, perlu persetujuan pemilik): `TANGGAL_TUTUP`, `DI_LUAR_JAM_OPERASIONAL` | `updateBookingSchedule` |
| R5 | `tambah_addon_lapangan` | BELUM | `p_booking_id uuid`, `p_items jsonb` (`[{"addon_id":uuid,"jumlah":int}]`), `p_catatan text DEFAULT NULL`, `p_backgrounds text[] DEFAULT NULL`, `p_izinkan_lewat_jam_tutup boolean DEFAULT false`, `p_expected_updated_at timestamptz DEFAULT NULL` | `{total_harga, durasi_total, sisa_pelunasan}` | `AKSES_DITOLAK`, `BOOKING_TIDAK_DITEMUKAN`, `STATUS_TIDAK_DIIZINKAN`, `ITEM_KOSONG`, `JUMLAH_TIDAK_VALID`, `ADDON_TIDAK_DITEMUKAN`, `ADDON_BUKAN_KATEGORI`, `MELEBIHI_MAKS`, `BACKGROUND_MELEBIHI_KUOTA`, `LEWAT_JAM_TUTUP`, `DATA_BERUBAH` | `addAddonsToBooking` seluruhnya: rumus 3.8 pindah ke SQL, termasuk penggabungan baris, status cetak, dan log |
| R6 | `kurangi_addon_lapangan` | BELUM | `p_booking_addon_id uuid`, `p_jumlah int`, `p_expected_updated_at timestamptz DEFAULT NULL` | `{total_harga, durasi_total, sisa_pelunasan}` | `AKSES_DITOLAK`, `ADDON_TIDAK_DITEMUKAN`, `BUKAN_TAMBAHAN_ADMIN`, `JUMLAH_TIDAK_VALID`, `STATUS_TIDAK_DIIZINKAN`, `DATA_BERUBAH` | `kurangiAddonLapangan` |
| R7 | `konversi_waiting_list` | BELUM | `p_waiting_list_id uuid`, `p_tanggal date` | `{booking_id, kode}` | `AKSES_DITOLAK`, `WAITING_LIST_TIDAK_DITEMUKAN`, `TANGGAL_KOSONG`, `SUDAH_DIKONVERSI`, `TANGGAL_TUTUP` | `convertWaitingListToBooking` (perilaku dipertahankan: DP 100000, jam default 09:00, paket cadangan) |

Perubahan non-RPC yang juga dibutuhkan Android (BELUM ada):

| # | Perubahan | Alasan |
|---|---|---|
| P1 | Policy `wisuda_events_admin_write`: `FOR ALL USING (is_admin()) WITH CHECK (is_admin())` | Agar admin bisa menambah, mengubah, dan menghapus acara wisuda dari Android |
| P2 | Policy storage `allow_admin_delete` pada `storage.objects` untuk `bucket_id = 'bukti-transfer' AND is_admin()` | Agar hapus booking dari Android juga bisa menghapus file bukti transfer |
| P3 | Policy storage bucket `backgrounds`: INSERT/UPDATE untuk `is_admin()`, SELECT publik | Upload foto background dari Android (cek dulu policy yang ada, lihat TIDAK JELAS #1) |
| P4 | Matikan sign-up publik di Supabase Auth (pengaturan dashboard, bukan SQL) | Semua user login dianggap admin |

Yang TETAP boleh query langsung dari Android (klasifikasi a), tanpa RPC:
- SELECT semua tabel.
- CRUD `categories`, `packages`, `addons`, `addon_categories`.
- UPSERT `settings`.
- UPDATE `waiting_list.sudah_dihubungi`.
- DELETE `bookings`, `waiting_list`.
- `createSignedUrl` untuk `bukti-transfer`.

---

## BAGIAN 3 — ATURAN BISNIS & RUMUS

### 3.1 Total harga
- Booking baru (`actions.ts › submitBooking`): `total_harga = packages.harga + Σ(addons.harga × jumlah)`, semua dari DB.
- Ganti paket (`updateBookingSchedule`): `total_harga = paket_baru.harga + Σ booking_addons.total`. Add-on lama tetap memakai harga salinannya.
- Add-on di lapangan: `total_harga += Σ(harga master terbaru × jumlah baru)`. Pengurangan: `total_harga -= harga_salinan_baris × k`.
- `sisa_pelunasan = total_harga - dp_dibayar`, dihitung database. Bisa negatif jika DP > total; database tidak membatasi.

### 3.2 Durasi total & `menit_per_unit`
- `durasi_total = packages.durasi_menit + Σ_{add-on jenis 'waktu'} (menit_per_unit × jumlah)`.
- Sumber `menit_per_unit`:
  - Booking baru: dari `addons.menit_per_unit`, lalu disalin ke `booking_addons.menit_per_unit`.
  - Hitung ulang (ganti paket): dari salinan `booking_addons.menit_per_unit`. Jika NULL/0/bukan bilangan bulat → **15**.
- Mengubah `addons.menit_per_unit` di admin TIDAK mengubah durasi booking yang sudah ada.
- Label satuan add-on waktu di web klien dan admin = `"+{menit_per_unit} menit"` (`labelSatuanWaktu`), bukan kolom `satuan`. Saat admin menyimpan add-on waktu, `satuan` juga diisi `"+{menit} menit"` (`AddonsClient.tsx › handleSave`).

### 3.3 Kuota background
- Kuota = `packages.jumlah_pilihan_background + Σ jumlah add-on jenis 'background'` (`Step5Form.tsx`, variabel `bgSlots`).
- Klien wajib memilih TEPAT sebanyak kuota. Pesan: `Silakan pilih tepat {n} warna background (saat ini {m} dipilih)`. Ini hanya divalidasi di browser.
- Add-on di lapangan: admin boleh memilih warna tambahan **maksimal** sebanyak unit add-on background yang ditambahkan (boleh kurang). Warna yang sudah dipilih tidak bisa dipilih lagi.

### 3.4 DP
- Booking klien: `dp_dibayar >= settings.dp_minimal` (default 100000) dan `<= total_harga`. Pesan: `DP minimal {Rp}` dan `DP tidak boleh melebihi total harga`. **Hanya di browser** (`Step6Pembayaran.tsx`), server tidak memvalidasi.
- Waiting list (publik): nominal DP = `settings.dp_minimal || 100000`. Hanya ditulis ke teks `catatan` (`DP: Rp 100.000 (via WA)`); kolom `waiting_list.dp_dibayar` tidak ditulis.
- Konversi waiting list → booking: `dp_dibayar = 100000` hardcode.

### 3.5 Slot jam
- Daftar slot booking (`getAvailableSlots`): mulai dari `jam_buka`, langkah `slot_interval`, slot dimasukkan selama `slot + durasi_total <= jam_tutup`, dan slot tidak "terblokir".
- "Terblokir" (`utils.ts › isSlotBlocked`): **hanya** jika sudah ada ≥ `MAX_BOOKING_PER_SLOT` (=1) booking berstatus `pending`/`booking` dengan **jam mulai sama persis** di tanggal itu. **Tidak ada pengecekan tumpang tindih durasi.** Booking 13:00 selama 45 menit TIDAK memblokir slot 13:30.
- Batas jam tutup: `jam_mulai >= jam_buka` dan `jam_mulai + durasi_total <= jam_tutup` (selesai tepat jam tutup diperbolehkan).
- Hari libur: jika `tanggal` ada di `settings.closed_dates`, tidak ada slot dan booking ditolak. Kalender (`ModernDatePicker`) juga menonaktifkan tanggal yang sudah lewat.
- Pengelompokan tampilan (`TimeSlotSelector.tsx`, `WaitingListModal.tsx`): **Pagi** = < 12:00; **Siang** = 12:00 ≤ jam < 15:00; **Sore & Malam** = ≥ 15:00. Subjudul hardcode: `'08:00 - 11:30'`, … `'15:00 - 20:00'`. Ini hanya tampilan.
- Reschedule admin memanggil `getAvailableSlots(tanggal, durasi, '08:00', '20:00', 30)` dengan **nilai hardcode**, bukan dari settings.

### 3.6 Waiting list & kunci slot wisuda
- Mode acara: satu jam per `acara_id` hanya boleh dipakai satu waiting list. Jam diambil dari `catatan` lewat `parseWaitingListInfo`. Slot = `generateTimeSlots(jam_buka, jam_tutup, slot_interval)`.
- Mode tanggal (lama): satu jam per tanggal untuk waiting list, ditambah cek `isSlotBlocked` terhadap booking.
- Kunci slot wisuda TIDAK memeriksa tabel `bookings`.

### 3.7 Siklus status

Status booking (`actions.ts › updateBookingStatus`):

| Dari \ Ke | `pending` | `booking` | `selesai` | `dibatalkan` |
|---|---|---|---|---|
| `pending` | – | ✅ | ❌ | ✅ |
| `booking` | ❌ | – | ✅ | ✅ |
| `selesai` | ❌ | ❌ | – | ❌ |
| `dibatalkan` | ❌ | ❌ | ❌ | – |

- Label UI (`ClientCardUI.tsx`): `pending` = "Menunggu", `booking` = "Dikonfirmasi", `selesai` = "Selesai", `dibatalkan` = "Dibatalkan". Di filter: "Menunggu Konfirmasi", "Dikonfirmasi", "Selesai", "Dibatalkan".
- Siapa yang mengubah: Sistem membuat `pending`; Admin mengubah sisanya. Database tidak menegakkan aturan ini.
- `dibatalkan`/`selesai` bersifat final; tombol aksi disembunyikan.
- Booking `pending` dan `booking` sama-sama "menempati" slot.

Status cetak (`bookings.status_cetak`):
- NULL = tidak ada cetak. Nilai lain: `'menunggu'` (label "Belum Dicetak" / tombol "Belum"), `'proses'` ("Sedang Dicetak" / "Proses"), `'selesai'` ("Selesai Cetak" / "Selesai").
- Booking dianggap "ada cetak" jika `paketPunyaCetak(package_snapshot)` atau ada `booking_addons` dengan jenis `cetak`. Bagian status cetak hanya tampil jika ada cetak; NULL ditampilkan sebagai "Belum".
- Admin bebas berpindah di antara ketiga nilai (tanpa aturan urutan), di status booking apa pun.
- Otomatis:
  - Booking baru dengan cetak → `'menunggu'`.
  - Add-on di lapangan menambah cetak saat `status_cetak` NULL → `'menunggu'`.
  - Koreksi menghapus cetak terakhir, paket tanpa cetak, dan status masih `'menunggu'` → NULL.
  - Ganti paket dan konversi waiting list TIDAK mengubah `status_cetak`.

### 3.8 Add-on di lapangan

Sumber: `addon-calc.ts`, `actions.ts › addAddonsToBooking/kurangiAddonLapangan`, RPC.

1. Status booking yang diizinkan: `pending` dan `booking`.
2. Add-on yang boleh dipilih: yang ada baris `addon_categories` untuk `booking.category_id`. Jika `category_id` NULL, semua add-on boleh.
3. `items` dengan `addon_id` sama dijumlahkan dulu. `jumlah` harus bilangan bulat ≥ 0; 0 diabaikan; jika semuanya 0 → `Pilih minimal satu add-on dengan jumlah lebih dari 0.`
4. Batas maks: `jumlahTerpakai(semua baris booking untuk addon itu) + jumlahBaru <= addons.maks`. Pesan: `Jumlah "{nama}" melebihi batas. Maks {maks}, sudah ada {terpakai}, sisa kuota {sisa}.`
5. Penggabungan: jika sudah ada baris dengan `ditambah_oleh_admin = TRUE`, `addon_id` sama, `harga` sama dengan harga master saat ini, dan (khusus waktu) `menit_per_unit` sama, jumlah baris itu dinaikkan. Jika tidak, dibuat baris baru. Baris pesanan awal klien (`ditambah_oleh_admin = FALSE`) TIDAK PERNAH diubah.
6. Baris baru menyalin `jenis`, `nama`, `harga`, dan `menit_per_unit` (waktu: `getMenitPerUnit`, lainnya NULL) dari master. `satuan`: waktu = `"+{menit} menit"`, lainnya = `addons.satuan`.
7. `deltaHarga = Σ harga_master × qty`. `deltaMenit = Σ menit × qty` (waktu saja). `tambahanBackground = Σ qty` add-on background. `adaCetak` = ada jenis cetak.
8. Peringatan jam tutup: hanya jika `deltaMenit > 0` dan `jam_mulai + durasi_total_baru > jam_tutup`. Admin wajib mencentang "Saya menyetujui sesi berlanjut melewati jam tutup studio." Server menolak tanpa flag tersebut.
9. Aturan bentrok jadwal TIDAK dicek ulang, sesuai aturan 3.5 (hanya jam mulai sama).
10. Koreksi (`rencanakanKurangiAddon`): hanya baris `ditambah_oleh_admin = TRUE`, dengan `1 <= k <= jumlah`. Pesan: `Add-on pesanan awal klien tidak bisa dikurangi lewat fitur ini.` / `Jumlah pengurangan harus antara 1 dan {n}.`
    - `jumlah - k = 0` → baris dihapus.
    - `deltaHarga = -harga_baris × k`, `deltaMenit = -getMenitPerUnit(baris) × k`.
    - UI menyediakan "−" (k=1, hanya jika jumlah > 1) dan hapus (k=jumlah).
11. Status cetak dan background: lihat 3.7 dan 3.3.

### 3.9 Reschedule & ganti paket
Lihat `updateBookingSchedule` di 2.2.
- Paket yang bisa dipilih: paket `aktif` dari kategori yang dipilih. Kategori boleh diganti.
- Jam: daftar dari `getAvailableSlots`. Jam lama tetap ditampilkan jika tanggal tidak berubah.
- Ringkasan di modal: durasi efektif = durasi paket + menit add-on; total = harga paket + Σ total add-on; sisa = `max(0, total - dp)`.

### 3.10 Format teks `waiting_list.catatan`

Dibuat oleh `submitWaitingList` dengan bagian dipisah `" | "`, berurutan:
`[Jam: HH:MM]` | `DP: Rp {n.toLocaleString('id-ID')} (via WA)` | `Kampus/Instansi: {kampus}`? | `Paket: {paket}`? | `Catatan: {catatan}`?

Setelah dikonversi, ditambah `" [Sudah Masuk Booking: {kode}]"`.

`parseWaitingListInfo` memakai regex berikut (tidak peka huruf besar/kecil):
- jam: `(?:\[Jam:\s*|Perkiraan Jam:\s*)(\d{1,2}:\d{2})`
- kampus: `Kampus(?:\/Instansi)?:\s*([^|\]]+)` (di-trim)
- dp: `DP:\s*([^|\]]+)`
- bookingKode: `\[Sudah Masuk Booking:\s*([^\]]+)\]`
- catatanTambahan: `Catatan:\s*([^|\]]+)`

Catatan: `catatanTambahan` ikut menangkap teks `[Sudah Masuk Booking: ...` karena regex berhenti di `|` atau `]`.

### 3.11 Nilai hardcode yang tersisa

| Nilai | Lokasi | Keterangan |
|---|---|---|
| 15 menit | `addon-calc.ts › DEFAULT_MENIT_PER_UNIT` | Fallback data lama saja |
| DP 100000 | `actions.ts › submitWaitingList` (fallback), `convertWaitingListToBooking` (tetap), `page.tsx`, `WaitingListModal.tsx`, `SettingsClient.tsx` (fallback input) | |
| Paket cadangan 100000 / 30 menit / 2 orang | `actions.ts › convertWaitingListToBooking` | |
| Jam default 09:00 | `convertWaitingListToBooking` | Jika jam tidak terbaca dari catatan |
| 08:00 / 20:00 / 30 | `RescheduleModal.tsx` (pemanggilan `getAvailableSlots`), fallback `getAvailableSlots`, default parameter banyak fungsi, `bookings/page.tsx` (`jamTutup` default) | |
| `MAX_BOOKING_PER_SLOT = 1` | `utils.ts` (bisa diubah via env) dan duplikat di `lib/constants.ts` (tidak dipakai) | |
| Batas Pagi/Siang/Sore 12:00 & 15:00 dan subjudulnya | `TimeSlotSelector.tsx`, `WaitingListModal.tsx` | |
| `'Desara Home Studio'` di template WA | `WhatsAppTemplateModal.tsx` (`catatanLokasi`) | Tidak membaca `settings.nama_studio` |
| Durasi minimum 30 | `updateBookingSchedule` (`pkg.durasi_menit \|\| 30`), `AddOnLapanganModal` lama | |
| Signed URL 3600 detik | `getBuktiTransferSignedUrl` | |
| Kapasitas cek waiting list `isSlotBlocked(jam, 30, ...)` | `submitWaitingList` | |

### 3.12 CONTOH UJI (test vector)

Semua output di bawah dihasilkan dengan menjalankan fungsi asli (`utils.ts`, `addon-calc.ts`) pada 9 Oktober 2026. Android wajib menghasilkan angka yang sama persis.

Data master yang dipakai:
- W20 = add-on waktu, harga 25000, maks 4, `menit_per_unit` 20.
- C4R = add-on cetak, harga 15000, maks 10.
- "Baris klien" = `booking_addons` W20 jumlah 1, `ditambah_oleh_admin = false`.

| # | Kasus | Input | Output yang diharapkan |
|---|---|---|---|
| 1 | Durasi, menit 15 | Paket 30 mnt + waktu (menit 15) ×2 | `durasi_total = 60` |
| 2 | Durasi, menit 20 & 30 (add-on ganda) | Paket 30 + waktu(20)×2 + waktu(30)×1 | `100` |
| 3 | Data lama tanpa `menit_per_unit` | Paket 45 + waktu(`menit_per_unit` NULL)×2 | `75` (NULL dibaca 15) |
| 4 | Nilai menit tidak valid & non-waktu | waktu(`menit_per_unit` 0)×1 + cetak(15)×3 | `15` (0 → 15; cetak 0 menit) |
| 5 | Total harga & sisa pelunasan | Paket 300000 + waktu 50000×2 + cetak 15000×3, DP 100000 | `total_harga = 445000`, `sisa_pelunasan = 345000` |
| 6 | Slot, durasi 45, tanpa booking | buka 08:00, tutup 20:00, interval 30 | 23 slot, pertama `"08:00"`, terakhir `"19:00"` |
| 7 | Slot bentrok (jam mulai sama saja) | Booking aktif 13:00 durasi 45; minta slot durasi 30 | `"13:00"` TIDAK tersedia, `"13:30"` tersedia, total 23 slot |
| 8 | Jam tutup | `isSlotWithinOperatingHours`: (19:30, 45, 08:00, 20:00) / (19:30, 30, …) / (07:30, 60, …) | `false` / `true` / `false` |
| 9 | Normalisasi jam saat cek bentrok | `isSlotBlocked("13:00:00", 30, [{jam_mulai:"13:00:00"}])` | `true` |
| 10 | Add-on lapangan melebihi maks | Baris klien W20×1, tambah W20×4 | Ditolak: `Jumlah "Tambah Waktu" melebihi batas. Maks 4, sudah ada 1, sisa kuota 3.` |
| 11 | Add-on lapangan pertama kali | Baris klien W20×1, tambah W20×3 | 1 baris BARU (jumlah 3, `menit_per_unit` 20, `satuan "+20 menit"`), `deltaHarga 75000`, `deltaMenit 60` |
| 12 | Penjumlahan tanpa baris ganda | Baris klien W20×1 + baris admin W20×1 (harga 25000); tambah W20×2 dan C4R×2 | `updateRows=[{id: baris admin, jumlah 3}]`, `insertRows` = C4R×2 (`menit_per_unit` null), `deltaHarga 80000`, `deltaMenit 40`, `adaCetak true` |
| 13 | Harga master berubah | Baris admin W20 harga 20000; tambah W20×1 (master 25000) | Baris BARU (tidak digabung), `deltaHarga 25000` |
| 14 | Ringkasan setelah tambah | total 350000, DP 100000, durasi 50; delta +80000 / +40 | `totalBaru 430000`, `sisaBaru 330000`, `durasiBaru 90` |
| 15 | Koreksi kurangi 1 | Baris admin W20 jumlah 3, kurangi 1 | `jumlah → 2`, `deltaHarga -25000`, `deltaMenit -20` |
| 16 | Koreksi baris klien | Baris klien, kurangi 1 | Ditolak: `Add-on pesanan awal klien tidak bisa dikurangi lewat fitur ini.` |
| 17 | Lewat jam tutup (lapangan) | jam_mulai 19:30, durasi 30, tambah waktu 20 mnt, jam_tutup 20:00 | Selesai `"20:20"` → butuh konfirmasi (`perluKonfirmasiJamTutup: true` jika belum dicentang) |
| 18 | Aksi status cetak | (NULL, cetak baru) / (`menunggu`, tak ada cetak tersisa, paket tanpa cetak) / (`proses`, tak ada cetak) | `menunggu` / `kosongkan` / `tetap` |
| 19 | Transisi ditolak | `selesai` → `booking` | Error `Tidak bisa mengubah status dari selesai ke booking.` |
| 20 | Transisi ditolak | `pending` → `selesai` | Error `Tidak bisa mengubah status dari pending ke selesai.` |
| 21 | Parse catatan waiting list | `[Jam: 09:30] \| DP: Rp 100.000 (via WA) \| Kampus/Instansi: UNTAN \| Paket: Silver \| Catatan: bawa toga [Sudah Masuk Booking: DSR-20261009-003]` | `jam "09:30"`, `kampus "UNTAN"`, `dp "Rp 100.000 (via WA)"`, `bookingKode "DSR-20261009-003"`, `catatanTambahan "bawa toga [Sudah Masuk Booking: DSR-20261009-003"` |
| 22 | Slot waiting list | `generateTimeSlots("08:00","20:00",30)` | 24 slot, `"08:00"` s/d `"19:30"` |
| 23 | Label satuan | waktu `menit_per_unit` 20 / NULL | `"+20 menit"` / `"+15 menit"` |
| 24 | Format Rupiah | 345000 | `"Rp 345.000"` |
| 25 | Kode booking | Booking pertama dibuat 9 Okt 2026 WIB, belum ada kode `DSR-20261009-*` | `"DSR-20261009-001"`; booking berikutnya hari itu `"DSR-20261009-002"` |

---

## BAGIAN 4 — LAYAR DAN FITUR ADMIN

Semua layar admin memerlukan login. Navigasi (`AdminNav.tsx`): **Booking** (`/admin/bookings`), **Waiting List** (`/admin/waitinglist`), **Paket** (`/admin/packages`), **Add-on** (`/admin/addons`), **Pengaturan** (`/admin/settings`), dan tombol logout (`supabase.auth.signOut()`). `/admin` diarahkan ke `/admin/bookings`.

Fitur klien publik (ringkasan satu baris):
- **Wizard booking 7 langkah**: Sambutan → Nama → Kategori → Pricelist → Form (background, WA, kampus, tanggal, jam, add-on, catatan, S&K) → Pembayaran DP → Sukses + pesan WA ke admin.
- **Pricelist modal**: katalog paket dan add-on per kategori.
- **Waiting list wisuda**: pilih acara, jam, data diri, lalu kirim. DP via WA.

### 4.1 Login (Peran: Admin)
- Layar `/admin/login`. Field **Email** (type email, wajib) dan **Password** (wajib). Tombol **"Masuk"** (menampilkan loading).
- Aksi: `supabase.auth.signInWithPassword({ email, password })`.
- Gagal → pesan merah **"Email atau password salah"**. Berhasil → ke `/admin/bookings`.
- Jika sudah login, membuka `/admin/login` langsung diarahkan ke `/admin/bookings`.

### 4.2 Daftar Booking (Peran: Admin)
Sumber: `bookings/page.tsx`, `BookingsClient.tsx`.

**Data yang dimuat:**
- semua `bookings` + `booking_addons(*)`, urut `created_at` menurun;
- `packages`, `categories`, `addons` (urut `urutan`), `addon_categories`;
- `settings` dengan key `backgrounds`, `jam_tutup`, `jam_buka`;
- email user.

**Filter (di klien):**
- Pencarian teks: "Cari nama klien atau kode booking..." (mencocokkan `nama_klien` atau `kode`, tidak peka huruf besar/kecil).
- Status: Semua Status / Menunggu Konfirmasi / Dikonfirmasi / Selesai / Dibatalkan.
- Cetak: Semua Cetak / Ada Cetak Foto / Cetak: Belum / Cetak: Proses / Cetak: Selesai. "Belum" juga mencakup `status_cetak` NULL pada booking yang punya cetak.
- Tanggal cepat: Semua / Hari Ini / Besok.
- Kalender (`AdminCalendarPicker`): menunjukkan jumlah booking non-batal per tanggal.

**Kartu booking (tertutup):**
- nama klien, lencana status, lencana cetak (jika ada cetak), lencana **"Tambahan di lapangan"** (jika ada baris `ditambah_oleh_admin`);
- `kode · kategori – paket`;
- chip tanggal (format `id-ID` weekday short) dan jam.

**Kartu booking (dibuka dengan klik):**
- WhatsApp (link `https://wa.me/{wa_klien}` tanpa normalisasi), Kampus/Instansi, Durasi Total (`{n} menit`), Background Dipilih, Catatan;
- tombol **"Lihat Bukti Transfer"** jika `bukti_transfer` ada (membuka signed URL; gagal → alert "Gagal memuat bukti transfer");
- **Rincian Add-on ({jumlah baris})**, per baris:
  - `{nama} ({jumlah}x)`;
  - waktu: `+{menit×jumlah} mnt`;
  - label "Di Lapangan" jika tambahan admin;
  - harga `harga×jumlah`;
  - untuk tambahan admin pada booking pending/booking: tombol **"−"** (jika jumlah > 1) dan ikon hapus;
- **Status Cetak Foto** (jika ada cetak): rincian paket/add-on cetak dan segmented control **Belum / Proses / Selesai**.

**Tombol aksi:**

| Tombol | Muncul jika | Aksi | Konfirmasi |
|---|---|---|---|
| **Konfirmasi Booking** | `pending` | status → `booking` | Tidak |
| **Tandai Selesai** | `booking` | status → `selesai` | Tidak |
| **+ Add-on (Di Lapangan)** | `pending` atau `booking` | Buka modal 4.3 | – |
| **Edit Jadwal & Paket** | selalu | Buka modal 4.4 | – |
| **Batalkan** | `pending` atau `booking` | status → `dibatalkan` | Tidak (tanpa dialog) |
| **Hapus** | selalu | `deleteBooking` | Dialog berisi nama, kode, tanggal, jam, dan "Tindakan ini akan menghapus data secara permanen dan tidak dapat dibatalkan." |
| **Template WA Client** | selalu | Buka modal 4.5 | – |

**State:**
- Kosong (setelah filter): "Tidak ada jadwal yang cocok dengan filter pencarian atau tanggal terpilih."
- Loading: tombol menampilkan spinner (`loading`).
- Error: kebanyakan memakai `alert(...)`. Error `updateBookingStatus` diabaikan.

**Timeline hari ini** (`BookingsClient.tsx`, bagian "Timeline Jadwal Harian"):
- Tanggal aktif = filter tanggal, atau "hari ini" jika filter kosong. Hari ini dihitung dengan `new Date().toISOString()`, yaitu UTC (lihat Bagian 7).
- Booking yang tampil: semua booking di tanggal itu yang statusnya **bukan** `dibatalkan` (termasuk `selesai`), diurutkan menurut `jam_mulai` (perbandingan string).
- Kotak hanya muncul jika ada minimal 1 sesi. Isinya:
  - judul "Jadwal Sesi: Hari Ini" (atau tanggal `YYYY-MM-DD`);
  - "{n} sesi terdaftar" dan lencana tanggal;
  - grid 2 kolom (HP) / 4 kolom (lebar), satu kartu per sesi: jam (`jam_mulai` mentah), lencana "Konfirm" (jika `booking`) atau "Menunggu" (selain itu, termasuk `selesai`), nama klien, `{package_nama} · {durasi_total}m`.
- Menekan kartu mengisi kotak pencarian dengan `kode` booking tersebut.
- Di bawahnya ada teks "Menampilkan {n} booking" dan tautan "Hapus filter tanggal" (jika ada filter tanggal). Daftar kosong menampilkan judul "Tidak Ada Booking Ditemukan".

### 4.3 Modal "Tambah Add-on (Di Lapangan)" (Peran: Admin)
Sumber: `AddOnLapanganModal.tsx`.

- Header: "Tambah Add-on (Di Lapangan)", `Booking: {kode} · {nama} ({paket})`.
- Info: Jadwal Sesi `{tanggal} · {jam} WIB`, Durasi Saat Ini `{n} menit`.
- Daftar add-on (hanya yang aktif untuk kategori booking). Per add-on:
  - nama;
  - waktu: chip `+{menit} mnt/unit`;
  - `{harga}/{satuan} · Maks: {maks}`;
  - `· Sudah ada: {n}` (jika > 0);
  - `Sisa kuota: {n}` atau **"Kuota habis"**;
  - stepper − / + dari 0 sampai sisa kuota.
- Jika memilih add-on background: bagian **"Pilih Warna Background Tambahan ({dipilih}/{kuota})"**. Warna yang sudah ada dicoret dan bertanda "(Sudah dipilih)".
- **Catatan Admin (Opsional)**: placeholder "Contoh: Klien minta tambah durasi 15 menit & cetak foto di tempat".
- **Ringkasan Penambahan**: `{n} item dipilih`, Tambahan Durasi, Estimasi Selesai Baru `{HH:MM} WIB (Total {n} mnt)`, Total Tambahan Biaya, Total Lama, Total Baru, DP Dibayar, Sisa Pelunasan Baru.
- Peringatan jam tutup (kotak kuning): "Peringatan Jam Operasional: Sesi foto diperkirakan selesai pukul {jam} WIB, melewati batas jam operasional studio ({jamTutup} WIB)." + checkbox "Saya menyetujui sesi berlanjut melewati jam tutup studio."
- Tombol **Batal** dan **Simpan Add-on**. Simpan nonaktif jika tidak ada item, atau jika peringatan jam tutup tampil tanpa centang.
- Error lokal: "Pilih minimal satu add-on yang ingin ditambahkan.", "Waktu sesi melebihi jam operasional tutup studio. Berikan centang persetujuan untuk melanjutkan.", serta pesan dari server (2.2, 2.4).

Konfirmasi koreksi dari kartu booking:
- Hapus: `Hapus add-on "{nama}" ({n}x) yang ditambahkan di lapangan?\n\nTotal harga dan durasi booking akan disesuaikan otomatis.`
- Kurangi: `Kurangi add-on "{nama}" sebanyak {k} (dari {n} menjadi {n-k})?\n\nTotal harga dan durasi booking akan disesuaikan otomatis.`

### 4.4 Modal "Edit Jadwal & Paket" (Reschedule) (Peran: Admin)
Sumber: `RescheduleModal.tsx`.

- Judul: **"Atur Ulang Jadwal & Paket"**.
- Bagian di modal:
  1. **"1. Edit Paket Foto"**: lencana "Paket Diubah" jika paket berbeda. Pilihan "Kategori:" (chip; memilih kategori otomatis memilih paket aktif pertamanya) dan "Pilih Paket Foto:" (paket `aktif` kategori itu). Ringkasan: "DP Masuk: {Rp} ➔ Sisa Pelunasan: {Rp}".
  2. **"2. Pilih Tanggal Baru"**: `ModernDatePicker`. Mengganti tanggal mengosongkan jam.
  3. **"3. Pilih Jam Mulai"**: grid slot. Kosong → "Tidak ada slot jam tersedia pada tanggal ini untuk durasi {n} menit."
  4. **"4. Keterangan / Alasan Perubahan (Opsional)"**, dengan teks "Tercatat di riwayat booking".
- Ringkasan: durasi efektif, total harga baru, sisa pelunasan baru (≥ 0).
- Tombol **Batal** / **Simpan Perubahan**.
- Validasi: tanggal dan jam wajib → "Pilih tanggal dan jam sesi terlebih dahulu."
- Simpan: `updateBookingSchedule(id, tanggal, jam, adminEmail, keterangan, paketId)`. Error dari server ditampilkan di modal.

### 4.5 Modal Template WhatsApp (Peran: Admin)
Sumber: `WhatsAppTemplateModal.tsx`.

**Tab:**
1. **Konfirmasi Booking**: "Kirim saat booking baru disetujui".
2. **Reminder Hari-H**: "Pengingat sesi di hari sesi foto".
3. **Kirim Link Foto**: "Kirim link Google Drive/cloud hasil foto". Ada input link Drive.
4. **Pengambilan Cetak**: "Pemberitahuan cetak foto selesai & siap diambil". Ada lencana "Ada Cetak" jika ada cetak.

**Aksi:** salin teks (clipboard) dan buka `https://wa.me/{nomor}?text={encodeURIComponent(pesan)}`.
- Nomor: hapus semua non-digit; jika diawali `0`, ganti dengan `62`.

**Variabel turunan:**
- `catatanLokasi = 'Desara Home Studio'`.
- `tanggalFormatted = new Date(tanggal).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'})`, contoh "Jumat, 9 Oktober 2026".
- `hasCetak` = paket punya cetak ATAU ada add-on cetak.
- `detailCetakText`:
  - paket: `"{cetak_ukuran||'Cetak Foto'} ({cetak_jumlah||1} lembar)"`;
  - setiap add-on cetak: `"{nama} ({jumlah}x)"`;
  - digabung `", "`; jika kosong `"Cetak Foto"`.
- `barisAddon` (baris NULL dibuang):
  - `• Add-on: {nama xJumlah, ...}` (baris pesanan awal);
  - `• Add-on Tambahan di Studio: {...}` (baris `ditambah_oleh_admin`);
  - `• Rincian Cetak: {detailCetakText}` (jika `hasCetak`).
- `booking.jam_mulai` ditampilkan apa adanya dari DB (bisa `"10:00:00"`).

Setiap template disusun per baris lalu digabung `\n`. Baris NULL/kosong dibuang, kecuali string kosong `''` di 'konfirmasi' dan 'reminder' yang terbuang karena `.filter(Boolean)`. **Akibatnya baris kosong pemisah juga hilang.** Lihat Daftar TIDAK JELAS #6.

**Template 1 — konfirmasi**
```
Halo Kak *{nama_klien}*! 👋
Terima kasih telah melakukan pemesanan di *Desara Home Studio*. Booking kamu sudah *DIKONFIRMASI* ✅
📌 *Detail Reservasi:*
• Kode Booking: *{kode}*
• Paket: {category_nama} - {package_nama}
{barisAddon...}
• Tanggal: *{tanggalFormatted}*
• Jam Sesi: *{jam_mulai} WIB* (Durasi: {durasi_total} menit)
• Pilihan Background: {pilihan_background dipisah ', '}      ← jika ada
• Instansi/Kampus: {kampus}                                  ← jika ada
💰 *Rincian Pembayaran:*
• Total Biaya: {formatRupiah(total_harga)}
• DP Dibayar: {formatRupiah(dp_dibayar)}
• Sisa Pelunasan: *{formatRupiah(sisa_pelunasan)}*
Mohon hadir tepat waktu (disarankan tiba 10-15 menit sebelum sesi dimulai). Sampai jumpa di studio! ✨
```

**Template 2 — reminder_h**
```
Halo Kak *{nama_klien}*! ⏰
Ini pengingat untuk jadwal sesi foto kamu *HARI INI* di *Desara Home Studio*:
📍 *Jadwal Sesi:*
• Tanggal: *{tanggalFormatted}*
• Jam Sesi: *{jam_mulai} WIB*
• Durasi: {durasi_total} menit
• Paket: {category_nama} - {package_nama}
{barisAddon...}
• Sisa Pelunasan: *{formatRupiah(sisa_pelunasan)}*   ← jika sisa_pelunasan > 0
• Status Pembayaran: *Lunas*                          ← jika sisa_pelunasan <= 0
💡 *Tips Penting:*
1. Mohon hadir 10-15 menit sebelum waktu sesi agar persiapan lebih santai.
2. Siapkan pakaian, outfit ganti, dan properti yang ingin digunakan.
Jika ada kendala di perjalanan, silakan kabari kami ya. Ditunggu kedatangannya! 🙏✨
```

**Template 3 — link_foto** (`{link}` = input admin, atau `[MASUKKAN_LINK_GOOGLE_DRIVE_DISINI]` jika kosong)
```
Halo Kak *{nama_klien}*! 📸✨
Terima kasih banyak sudah berfoto di *Desara Home Studio*!
Hasil foto sesi kamu (*{kode}*) sudah selesai dan siap diakses melalui tautan berikut:
🔗 *Link Hasil Foto:*
{link}
Mohon untuk segera mendownload dan mem-backup foto-fotonya ya Kak.

ℹ️ *Catatan Cetakan:* Pesanan cetak foto kamu sedang kami proses dan akan kami kabari segera setelah selesai ya! 🖼️   ← jika hasCetak (diawali "\n")
Jangan lupa tag akun kami di Instagram/TikTok jika kamu mengunggah fotonya ya! Semoga suka dengan hasilnya! 💖
```

**Template 4 — ambil_cetakan**
```
Halo Kak *{nama_klien}*! 🖼️🎉
Kabar baik! Hasil cetakan foto kamu dari sesi (*{kode}*) sudah *SELESAI DICETAK* dan siap diambil:
📦 *Detail Cetakan:*
• {detailCetakText}
📍 *Lokasi Pengambilan:*
*Desara Home Studio*
Kamu bisa mengambil cetakan pada jam operasional studio. Mohon konfirmasi perkiraan waktu kedatangan sebelum mengambil ya Kak. Terima kasih! 🙏✨
```

### 4.6 Waiting List & Acara Wisuda (Peran: Admin)
Sumber: `waitinglist/page.tsx`, `WisudaEventManager.tsx`, `WaitingListClient.tsx`.

**Manajemen Acara Wisuda** (bagian atas):
- Judul "Manajemen Acara Wisuda", `{n} aktif`, tombol **Tambah Acara** / **Batal**.
- Form tambah:
  - **Nama Acara \*** (placeholder "cth. Wisuda UNTAN Oktober 2026");
  - **Kampus / Instansi \*** ("cth. Universitas Tanjungpura");
  - **Keterangan (opsional)** ("cth. Gelombang 1, Semester Gasal 2026");
  - tombol **Simpan Acara**.
  - Validasi: "Nama acara dan kampus wajib diisi."
  - Berhasil: "Acara wisuda berhasil ditambahkan."
- Per acara: edit inline (Nama Acara \*, Kampus \*, Keterangan), aktif/nonaktif ("Acara {dinonaktifkan|diaktifkan}."), hapus.
  - Dialog hapus: `Hapus acara "{nama}"?\n\nPerhatian: Data waiting list yang terhubung ke acara ini tidak akan ikut terhapus.`
  - Edit berhasil: "Acara wisuda berhasil diperbarui."
- Kosong: "Belum ada acara wisuda" / "Tambahkan acara wisuda agar client dapat mendaftar waiting list".

**Daftar Waiting List:**
- Data: `waiting_list` urut `created_at` menurun, dan `closed_dates`.
- Kosong: "Waiting List Kosong" / "Belum ada client yang mendaftar ke antrean waiting list."
- Kartu tertutup:
  - nama + lencana status: "Sudah Masuk Bookings ({kode})" jika sudah dikonversi; "Sudah Dihubungi" jika `sudah_dihubungi`; selain itu "Menunggu Konfirmasi";
  - `kategori · paket · acara`;
  - chip tanggal (jika mode tanggal), jam, acara, kampus;
  - waktu daftar.
- Kartu terbuka: WhatsApp, Kampus/Instansi, Acara Wisuda, Waktu Pendaftaran, Catatan mentah.
- Tombol:
  - **Masukkan ke Bookings** (jika belum dikonversi) atau **Lihat di Bookings**;
  - **WA** (`https://wa.me/{wa}`);
  - **Tandai** (jika belum dihubungi dan belum dikonversi);
  - **Hapus**, dengan dialog `Apakah Anda yakin ingin MENGHAPUS PERMANEN data waiting list client "{nama}"?\n\nTindakan ini tidak dapat dibatalkan.`
- Modal konversi "Masukkan ke Bookings":
  - ringkasan data, **Pilih Tanggal Sesi** (default `tanggal_ingin` atau hari ini UTC);
  - info "Booking dibuat dengan status Menunggu. Paket & jam dari waiting list otomatis terpindah. Tanggal di atas yang akan tercatat di bookings.";
  - tombol **Batal** / **Konfirmasi & Buat Booking**;
  - berhasil: "Berhasil! Data client dimasukkan ke Bookings dengan status Menunggu (Kode: {kode})."

### 4.7 Kategori & Paket (Peran: Admin)
Sumber: `PackagesClient.tsx` (query langsung dengan klien browser, RLS).

- **Tambah kategori**: input "Nama kategori baru" + tombol **Tambah Kategori** (atau Enter).
  - `slug = nama.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')`.
  - `urutan = max + 1`.
  - Nama kosong diabaikan.
- **Kategori**: toggle aktif/nonaktif (lencana "Nonaktif"), hapus dengan dialog "Hapus kategori ini? Semua paket di dalamnya juga terhapus.", buka/tutup daftar paket (`{n} paket`).
- **Form paket**:

  | Field | Wajib | Jika kosong/tidak valid |
  |---|---|---|
  | Nama paket | Tidak divalidasi | – |
  | Harga (Rp) | – | `parseInt` gagal → 0 |
  | Durasi (menit) | – | default form 60; gagal → 60 |
  | Jumlah background | – | default 2; gagal → 1 |
  | Maks. orang | – | default 4; gagal → 1 |
  | Ukuran cetak (opsional) | Tidak | "cth. 12R"; kosong → null |
  | Jumlah cetak | Tidak | kosong → null |
  | Bonus (opsional) | Tidak | kosong → null |

  Tombol **Simpan** / **Batal**.
- **Penting**: `jumlah_foto_edit` SELALU diset `null` saat simpan (data lama hilang).
- Tidak ada UI untuk `packages.aktif` dan `urutan`.
- Hapus paket: dialog "Hapus paket ini?".
- Error query tidak ditampilkan.

### 4.8 Add-on (Peran: Admin)
Sumber: `AddonsClient.tsx`, `addons/page.tsx`.

- Tombol **Tambah Add-on**.
- Form:

  | Field | Aturan |
  |---|---|
  | Jenis | `waktu`/`background`/`orang`/`cetak` |
  | Nama | Wajib → "Nama add-on wajib diisi." |
  | **Menit per unit \*** | Hanya untuk waktu. Bilangan bulat ≥ 1 → "Menit per unit harus berupa angka bulat dan minimal 1 menit."; hint "Durasi tambahan waktu dalam satuan menit (minimal 1)" |
  | Satuan | Untuk waktu, otomatis `"+{menit} menit"`; jenis lain bebas (placeholder "+1 orang") |
  | Harga | gagal → 0 |
  | Maks | gagal → 5 |
  | Ukuran | opsional; kosong → null |

  Untuk jenis non-waktu, `menit_per_unit` disimpan 15.
- Add-on baru otomatis diaktifkan untuk SEMUA kategori (insert `addon_categories`).
- Per add-on: tampilan `{jenis} ({menit} mnt/unit) · {satuan} · {harga}/satuan · Maks {maks}`, toggle per kategori (insert/delete `addon_categories`), edit, hapus ("Hapus add-on ini?").
- Error (sejak 9 Okt 2026): gagal simpan tampil di form. Jika kolom `menit_per_unit` belum ada: pesan meminta menjalankan migrasi 005. Gagal hapus atau toggle kategori → alert.

### 4.9 Pengaturan Studio (Peran: Admin)
Sumber: `SettingsClient.tsx`.

- Setiap field punya tombol **Simpan** sendiri (berubah menjadi "Tersimpan" selama 2 detik) dan memanggil `updateSetting(key, value)`.
- **Info Studio**: Nama Studio, Teks Sambutan.
- **Kontak & Pembayaran**: Nomor WA Admin (hint "Format: 628xxxxxxxxxx"), Nomor Rekening BNI, Nama Rekening, DP Minimal (Rp) (number; gagal → 100000).
- **Jam Operasional**: Jam Buka (time), Jam Tutup (time), Interval slot (menit) (number; gagal → 30; hint "Interval antar slot yang ditampilkan ke klien").
- **Daftar Background & Foto Contoh Hasil**:
  - tambah nama ("Nama background baru (cth. Putih Bersih, Terracotta)");
  - hapus;
  - unggah foto contoh per background (upload → `image_url`). Gagal → alert "Gagal upload foto: {error}";
  - hapus foto. Setiap perubahan langsung menyimpan `backgrounds`.
- **Tanggal Tutup/Libur**:
  - tanggal (date) + keterangan wajib ("cth. Libur Bersama, Renovasi Studio, Jadwal Khusus").
  - Validasi: "Pilih tanggal yang ingin ditutup terlebih dahulu." / "Isi keterangan/alasan tanggal ditutup (cth. Libur Bersama, Renovasi)."
  - Tanggal yang sama akan diganti. Daftar diurutkan menaik. Ada hapus/buka kembali.
- Tidak ada UI untuk `tampilkan_waiting`.
- Error simpan tidak ditampilkan.

---

## BAGIAN 5 — DESAIN DAN IDENTITAS VISUAL

Sumber:
- `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`
- `src/components/ui/Button.tsx`, `src/components/ui/Input.tsx`
- `src/components/admin/shared/ClientCardUI.tsx`, `AdminNav.tsx`

Warna Tailwind standar (amber, emerald, dll.) memakai palet bawaan Tailwind v3.

### 5.1 Palet warna utama (variabel CSS di `:root`)

| Nama token | RGB | Hex | Pemakaian |
|---|---|---|---|
| `forest` | 38 79 67 | `#264F43` | Warna merek utama: tombol utama, chip terpilih, judul aksen, ikon |
| `forest-light` | 52 107 90 | `#346B5A` | Tombol utama saat ditekan/hover |
| `cream` | 250 245 235 | `#FAF5EB` | Latar halaman, teks di atas tombol `forest` |
| `cream-dark` | 240 232 216 | `#F0E8D8` | Latar sekunder (dipakai dengan transparansi 20–60%) |
| `blitz` | 251 191 36 | `#FBBF24` | Aksen kuning "blitz kamera": tombol sekunder, outline fokus, cincin slot terpilih |
| `text` | 20 30 28 | `#141E1C` | Teks utama |
| `text-muted` | 100 116 108 | `#64746C` | Teks sekunder/keterangan |
| `surface` | 255 255 255 | `#FFFFFF` | Kartu, modal, input |
| `border` | 220 214 200 | `#DCD6C8` | Garis tepi kartu dan input |

Mode gelap: variabel `.dark` sudah didefinisikan (cream `#161C1A`, cream-dark `#1E2624`, text `#F0EEE8`, muted `#A0ACA6`, surface `#1C2422`, border `#3C4844`), tetapi **tidak ada kode yang mengaktifkan kelas `.dark`**, jadi web selalu tampil terang. Android: wajib tema terang; tema gelap opsional dengan nilai di atas.

### 5.2 Tipografi
- Judul/tombol/angka penting: **Bricolage Grotesque** (berat 400, 600, 700). Kelas `font-heading`.
- Teks isi: **DM Sans** (berat 400, 500). Kelas `font-body`; seluruh `<body>` memakai DM Sans dengan antialiasing.
- Ukuran yang sering dipakai di admin:
  - judul halaman `text-2xl` bold (24sp);
  - judul kartu 15–16sp semibold;
  - teks isi `text-sm`/`text-xs` (14/12sp);
  - lencana 11sp medium;
  - label kecil 10sp.
- Kedua font tersedia gratis di Google Fonts (lisensi OFL).

### 5.3 Bentuk, radius, bayangan
- Radius:
  - tombol & input `rounded-xl` (12dp);
  - kartu booking/waiting list `rounded-xl` (12dp);
  - modal `rounded-3xl` (24dp);
  - kotak ringkasan/opsi di modal `rounded-2xl` (16dp);
  - lencana `rounded-full`;
  - chip info `rounded-md` (6dp);
  - chip slot/tanggal cepat `rounded-lg` (8dp).
- Garis: kartu memakai border 1dp `border`; input dan tombol ghost memakai border **2dp**; modal memakai border 2dp.
- Bayangan: sangat tipis (`shadow-xs`/`shadow-sm`). Modal memakai `shadow-2xl` dengan latar gelap `black/60` + blur.
- Animasi: tombol mengecil ke 98% saat ditekan; modal muncul dengan fade + slide 20px + skala 0.96→1 (±0.25 detik). Web menghormati "reduce motion".

### 5.4 Komponen

**Tombol** (`Button.tsx`): semua tombol `rounded-xl`, font heading semibold; nonaktif = opasitas 50%; loading = spinner bulat menggantikan isi tombol.

| Varian | Latar | Teks | Border | Dipakai untuk |
|---|---|---|---|---|
| `primary` | `forest` | `cream` | – | Aksi utama: Simpan, Konfirmasi Booking, Masuk |
| `secondary` | `blitz` | `text` | – | Tandai Selesai |
| `ghost` | transparan | `text` | 2dp `border` (hover `forest`) | Batal, Edit Jadwal, Hapus, WA |
| `danger` | `#DC2626` | putih | – | (tersedia, jarang dipakai) |

Ukuran: `sm` = padding 16×8, teks 14; `md` = 24×12, teks 16; `lg` = 32×16, teks 18. Tombol di kartu booking tingginya minimal 40dp.

**Input** (`Input.tsx`): label di atas, kotak `rounded-xl` border 2dp, latar `surface`. Ada teks `hint` kecil di bawah dan pesan `error` merah.

**Kartu** (`ClientCardShell`):
- `rounded-xl`, border 1dp, latar putih, isi bisa dibuka-tutup (accordion).
- Hover: border `forest` 35%.
- Kartu waiting list yang sudah dikonversi: border `#A7F3D0` dengan latar hijau sangat muda.

**Modal**: latar layar gelap 60%; panel putih `rounded-3xl`, lebar maks ±576dp (`max-w-xl`); header hijau `forest` dengan teks putih dan tombol tutup (X); isi bisa digulir; footer berisi tombol rata kanan.

**Chip info** (`InfoChip`), varian:
- `neutral`: latar `cream-dark` 40%;
- `forest`: latar `forest` 8%, teks `forest`;
- `blitz`: latar `blitz` 15%;
- `amber`;
- `purple`.

### 5.5 Pemetaan warna status (lencana: latar / teks / border)

| Status | Label | Latar | Teks | Border |
|---|---|---|---|---|
| `pending` | Menunggu | amber-50 `#FFFBEB` | amber-800 `#92400E` | amber-200 `#FDE68A` (80%) |
| `booking` | Dikonfirmasi | emerald-50 `#ECFDF5` | emerald-800 `#065F46` | emerald-200 `#A7F3D0` (80%) |
| `selesai` | Selesai | teal-50 `#F0FDFA` | teal-800 `#115E59` | teal-200 `#99F6E4` (80%) |
| `dibatalkan` | Dibatalkan | rose-50 `#FFF1F2` | rose-700 `#BE123C` | rose-200 `#FECDD3` (80%) |
| cetak `menunggu` (dan NULL) | Belum Dicetak (ikon printer) | amber-50 | amber-800 | amber-200 |
| cetak `proses` | Sedang Dicetak | purple-50 `#FAF5FF` | purple-800 `#6B21A8` | purple-200 `#E9D5FF` |
| cetak `selesai` | Selesai Cetak | emerald-50 | emerald-800 | emerald-200 |
| Waiting list: sudah dikonversi | Sudah Masuk Bookings ({kode}) | emerald-50 | emerald-800 | emerald-200 |
| Waiting list: sudah dihubungi | Sudah Dihubungi | stone-100 `#F5F5F4` | stone-700 `#44403C` | stone-200 `#E7E5E4` |
| Waiting list: baru | Menunggu Konfirmasi | amber-50 | amber-800 | amber-200 |
| Add-on tambahan admin | Di Lapangan / Tambahan di lapangan | blue-50 `#EFF6FF` | blue-700 `#1D4ED8` | blue-200 `#BFDBFE` |
| Chip menit add-on waktu | `+{n} mnt` | amber-50 | amber-800 | amber-200 |

Tombol segmen status cetak (terpilih): Belum = amber-100 `#FEF3C7` / amber-900 `#78350F`; Proses = purple-100 `#F3E8FF` / purple-900; Selesai = emerald-100 `#D1FAE5` / emerald-900.

Timeline hari ini: "Konfirm" = emerald-100/emerald-800; selain itu "Menunggu" = amber-100/amber-800.

### 5.6 Ikon
Web memakai **Lucide** (`lucide-react`). Ikon yang dipakai di admin:
- Navigasi: `Calendar` (Booking), `Clock` (Waiting List), `Package` (Paket), `ListOrdered` (Add-on), `Settings` (Pengaturan), `LogOut`, `Menu`, `X`.
- Kartu dan aksi: `Search`, `MessageCircle` (WA), `ChevronDown/Up`, `CheckCircle`, `XCircle`, `Flag` (Tandai Selesai), `ExternalLink`, `CalendarDays`, `Layers`, `Printer`, `Trash2`, `PlusCircle`, `Plus`, `Minus`, `Sparkles` (add-on), `AlertTriangle`, `Palette`, `Copy`, `Check`, `CalendarCheck`, `ClockAlert`, `Image`, `GraduationCap`, `School`, `Pencil`, `ToggleLeft/Right`, `Info`, `FileText`, `PackageCheck`, `AlertCircle`.

Android: pakai Material Symbols yang setara (`calendar_month`, `schedule`, `inventory_2`, `format_list_numbered`, `settings`, `logout`, `search`, `chat`, `print`, `delete`, `add_circle`, `remove`, `auto_awesome`, `warning`, `palette`, `content_copy`, `check`, `event_available`, `school`, `edit`, `toggle_on/off`). Lucide juga tersedia sebagai ikon Compose pihak ketiga jika ingin identik.

### 5.7 Logo
`public/logo.png` (dan `logo.jpg`), dipakai di login dan navigasi admin. Salin file ini untuk ikon aplikasi Android (adaptive icon dengan latar `cream` atau `forest`).

### 5.8 Nada bahasa
- Bahasa Indonesia santai-sopan.
- Ke klien (template WA) memakai "Kak", "kamu", emoji, dan tanda tebal WhatsApp `*...*`.
- Di panel admin: kalimat pendek dan langsung, contoh "Konfirmasi Booking", "Tandai Selesai", "Masukkan ke Bookings".
- Konfirmasi berbahaya ditulis HURUF BESAR pada kata kunci, contoh "MENGHAPUS PERMANEN".
- Satuan: "menit"/"mnt", "WIB", "Rp".

### 5.9 Padanan Material 3 / Jetpack Compose

| Web | Material 3 (Compose) |
|---|---|
| `forest` | `colorScheme.primary` (`#264F43`), `onPrimary` = `#FAF5EB` |
| `forest-light` | `primaryContainer` atau warna "pressed" |
| `blitz` | `colorScheme.secondary` (`#FBBF24`), `onSecondary` = `#141E1C` |
| `cream` | `background` (`#FAF5EB`), `onBackground` = `#141E1C` |
| `surface` | `surface` (`#FFFFFF`), `onSurface` = `#141E1C` |
| `cream-dark` | `surfaceVariant` (`#F0E8D8`), `onSurfaceVariant` = `#64746C` |
| `border` | `outline` / `outlineVariant` (`#DCD6C8`) |
| merah error | `error` (`#DC2626`) |
| Button primary | `Button` (filled), `shape = RoundedCornerShape(12.dp)` |
| Button secondary | `Button` dengan `containerColor = secondary` |
| Button ghost | `OutlinedButton` dengan `BorderStroke(2.dp, outline)` |
| Input | `OutlinedTextField`, shape 12dp, `supportingText` untuk hint/error |
| Kartu | `Card` / `OutlinedCard` shape 12dp, border 1dp, elevasi 0–1dp |
| Modal | `ModalBottomSheet` (disarankan di HP) atau `Dialog` shape 24dp dengan header `primary` |
| Lencana status | `Surface` shape `CircleShape`/`RoundedCornerShape(50)` dengan warna 5.5, teks 11sp |
| Chip tanggal cepat / filter | `FilterChip` |
| Segmen status cetak | `SingleChoiceSegmentedButtonRow` |
| Navigasi samping | `NavigationBar` (bawah) untuk HP; `NavigationRail` untuk tablet |
| Font | `FontFamily` Bricolage Grotesque untuk `display/headline/title/label`, DM Sans untuk `body` |

---

## BAGIAN 6 — INTEGRASI

### 6.1 Environment variable
| Nama | Fungsi | Boleh di Android? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyek Supabase. Kode membuang akhiran `/rest/v1` dan `/` di akhir | Ya |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (publik, dibatasi RLS) | Ya |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key, melewati semua RLS. Hanya di server web | **TIDAK. Jangan pernah dimasukkan ke APK** |
| `MAX_BOOKING_PER_SLOT` / `NEXT_PUBLIC_MAX_BOOKING_PER_SLOT` | Kapasitas booking per jam mulai (default 1) | Samakan nilainya (konstanta) |

### 6.2 Server Action yang memakai service role (JANGAN ditiru langsung di Android)
`submitBooking`, `submitWaitingList`, `getWaitingListSlotStatus`, `getWisudaSlotStatus`, `getWisudaEvents`, `createWisudaEvent`, `updateWisudaEvent`, `deleteWisudaEvent`, `convertWaitingListToBooking`, `getAvailableSlots`, `updateBookingStatus`, `updateBookingSchedule`, `markWaitingListContacted`, `updateSetting`, `uploadBackgroundImage`, `getBuktiTransferSignedUrl`, `updateCetakStatus`, `deleteBooking`, `deleteWaitingList`.

Yang memakai sesi admin (RLS): `addAddonsToBooking`, `kurangiAddonLapangan`, semua halaman admin (membaca data), `PackagesClient`, `AddonsClient`.

### 6.3 Login admin
- Supabase Auth email + password (`signInWithPassword`). Logout dengan `signOut()`.
- Tidak ada pengecekan role (lihat 1.7). Android: login dengan anon key, lalu semua query memakai sesi user tersebut.
- Akun admin dibuat manual di Supabase Dashboard (**TIDAK JELAS** prosedurnya; tidak ada UI pendaftaran di web).

### 6.4 Format
- **Tanggal**: disimpan `YYYY-MM-DD` (DATE). Ditampilkan dengan `toLocaleDateString('id-ID', …)`. Kartu: `{weekday:'short', day:'numeric', month:'short', year:'numeric'}`. WA: `{weekday:'long', day:'numeric', month:'long', year:'numeric'}`.
- **Jam**: dikirim `"HH:MM"`, dibaca kembali sebagai `"HH:MM:SS"`. Selalu normalisasi ke `HH:MM` sebelum membandingkan (`normalizeTime`).
- **Zona waktu**: WIB / Asia/Jakarta (UTC+7). Kode booking memakai `Asia/Jakarta`.
  - Perhatian: "Hari Ini" dan "Besok" di daftar booking, serta default tanggal modal konversi, memakai `new Date().toISOString()` (UTC). Antara 00:00–06:59 WIB, "Hari Ini" menunjuk tanggal kemarin.
  - Android sebaiknya memakai Asia/Jakarta (lihat Bagian 7).
- **Rupiah**: `formatRupiah` → `"Rp 345.000"` (pemisah ribuan titik, tanpa desimal, U+00A0 setelah "Rp"). Teks log memakai `"Rp " + n.toLocaleString('id-ID')` (spasi biasa).
- **Nomor WhatsApp**: disimpan apa adanya (bisa `08…` atau `62…`). Template WA menormalisasi: buang non-digit, awalan `0` → `62`. Link di kartu booking/waiting list memakai nomor mentah tanpa normalisasi.

### 6.5 Link wa.me
Format: `https://wa.me/{nomor}?text={encodeURIComponent(teks)}`. Nomor dinormalisasi seperti 6.4. Teks dari template 4.5, baris dipisah `\n`.

### 6.6 Upload & signed URL
- Foto background: lihat `uploadBackgroundImage` (2.2). URL publik disimpan ke `settings.backgrounds[i].image_url`.
- Bukti transfer: `createSignedUrl(path, 3600)` di bucket `bukti-transfer`, lalu dibuka di tab baru.

---

## BAGIAN 7 — RISIKO

1. **Logika yang hanya ada di Server Action** (tidak di database): transisi status (3.7), cek slot dan jam operasional, ganti paket, konversi waiting list, serta perencanaan add-on di lapangan. Jika Android menulis langsung ke tabel, database TIDAK akan menolak data yang salah. Solusinya RPC bersama (2.5).
2. **Service role**: hampir semua aksi admin web melewati RLS. Android dengan sesi admin akan ditolak pada:
   - tulis `wisuda_events`;
   - hapus file `bukti-transfer`;
   - mungkin upload `backgrounds`.
3. **Aksi admin web tanpa cek login**: semua Server Action admin kecuali `addAddonsToBooking`/`kurangiAddonLapangan` tidak memanggil `requireAdmin()`. Ini risiko keamanan web, bukan Android, tetapi perlu diketahui saat menyamakan perilaku.
4. **Semua user login = admin** (1.7). Pastikan sign-up publik dimatikan.
5. **Log gagal diam-diam**: `updateBookingSchedule` dan `updateCetakStatus` menulis `booking_status_log.status_ke = NULL` (kolom NOT NULL), sehingga riwayat tidak tersimpan. Android jangan meniru; isi `status_ke` dengan status booking saat ini.
6. **Aturan yang hanya ditegakkan di browser**:
   - DP minimal dan DP ≤ total (3.4);
   - kuota background tepat;
   - wajib WA;
   - tanggal lampau;
   - validasi form paket.

   Database juga mengizinkan siapa saja INSERT ke `bookings`/`booking_addons`/`booking_status_log` (policy `WITH CHECK (TRUE)`), sehingga data aneh mungkin ada.
7. **Hardcode di komponen UI**: Reschedule memakai 08:00/20:00/30; template WA memakai nama studio tetap; batas Pagi/Siang/Sore; DP konversi 100000 (3.11).
8. **Data lama**:
   - `booking_addons.menit_per_unit` NULL → harus dibaca 15. Jika versi lama 005 sempat dijalankan, semua baris lama berisi 15.
   - `status_cetak` NULL pada booking lama yang sebenarnya punya cetak → web menampilkannya sebagai "Belum".
   - `pilihan_background` bisa NULL.
   - `settings.backgrounds` bisa berupa array string ATAU objek.
   - `bukti_transfer` hanya ada di data lama.
9. **Migrasi 005 mungkin belum dijalankan**. Kolom `menit_per_unit`/`ditambah_oleh_admin`/`ditambah_pada` dan RPC belum ada → query yang menyebut kolom itu akan error. Android sebaiknya memeriksa versi skema atau menampilkan pesan yang jelas.
10. **Tipe `status_cetak` bisa berbeda** antar database (TEXT vs enum). Kirim selalu sebagai string.
11. **Format jam** `"HH:MM:SS"` dari DB vs `"HH:MM"` dari input. Perbandingan string tanpa normalisasi akan gagal (contoh: Reschedule web mendorong `booking.jam_mulai` mentah ke daftar slot).
12. **Zona waktu**: kode web memakai UTC untuk "hari ini" di beberapa tempat (6.4).
13. **Klien lama**: halaman web yang terbuka sebelum update mungkin masih mengirim data versi lama. Validasi server tetap menjadi acuan.
14. **FK tanpa ON DELETE**: menghapus `categories`/`packages`/`addons` yang sudah dipakai booking akan gagal karena FK `bookings.category_id`, `bookings.package_id`, `booking_addons.addon_id`. Web (Paket) tidak menampilkan error ini.
15. **`PackagesClient` menimpa `jumlah_foto_edit` dengan NULL** setiap simpan. Android jangan meniru jika ingin mempertahankan data.
16. **Kode booking** dibuat trigger dengan tanggal pembuatan (WIB). Android tidak boleh membuat kode sendiri; kirim `kode: ''`.
17. **Label timeline salah untuk `selesai`**: timeline hari ini menampilkan booking `selesai` dengan lencana "Menunggu" (hanya `booking` yang berlabel "Konfirm"). Android sebaiknya meniru persis atau ditanyakan dulu ke pemilik (TIDAK JELAS #13).
18. **Urutan timeline** memakai perbandingan string `jam_mulai`. Aman selama formatnya `HH:MM:SS` dengan nol di depan.
19. **Tema gelap tidak aktif di web** (Bagian 5.1). Jika Android menyalakan tema gelap mengikuti sistem, tampilannya akan berbeda dari web.
20. **Migrasi 005 versi lama vs baru**: jika versi lama pernah dijalankan, `booking_addons.menit_per_unit` baris lama berisi 15 (bukan NULL), dan `status_cetak` bisa bertipe enum `cetak_status`. Hasil hitungannya tetap sama.

---

## BAGIAN 8 — REKOMENDASI TEKNOLOGI ANDROID

Pilihan di bawah dibuat untuk pemula yang dibantu AI: populer (banyak contoh dan dokumentasi), resmi dari Google atau komunitas besar, dan sedikit "sihir". Pakai **versi stabil terbaru** saat proyek dibuat. Jangan menulis nomor versi dari ingatan; cek di Android Studio / Maven Central.

| Kebutuhan | Pilihan | Alasan singkat | Alternatif |
|---|---|---|---|
| Bahasa | **Kotlin** | Bahasa resmi Android | – |
| UI | **Jetpack Compose + Material 3** | Standar baru Google, cocok dengan desain kartu/lencana web | XML Views (tidak disarankan untuk proyek baru) |
| Arsitektur | **MVVM** (`ViewModel` + `StateFlow` + layar Compose) dengan lapisan repository | Pola paling umum, mudah dijelaskan ke AI | MVI (lebih rumit) |
| Navigasi | **Navigation Compose** (rute bertipe/type-safe) | Resmi, satu Activity | – |
| Backend | **supabase-kt**: modul Auth, Postgrest, Storage (+ Functions jika memakai Edge Function) | Klien Kotlin resmi komunitas Supabase; mendukung login, query, RPC (`postgrest.rpc`), dan signed URL | Retrofit + REST Supabase manual (lebih banyak kode) |
| HTTP engine | Ktor client engine **OkHttp** (dipakai supabase-kt) | Stabil di Android | Ktor Android engine |
| Serialisasi | **kotlinx.serialization** | Dipakai supabase-kt | – |
| Injeksi dependensi | **Koin** | Paling sederhana untuk pemula: tanpa anotasi dan tanpa kapt/ksp | **Hilt** (resmi Google, lebih ketat, cocok jika tim berkembang) |
| Gambar | **Coil** (versi Compose) | Ringan, khusus Kotlin/Compose; untuk foto background dan bukti transfer | Glide |
| Penyimpanan lokal | **DataStore (Preferences)** untuk preferensi kecil. Sesi login disimpan oleh supabase-kt Auth (session manager bawaan), jangan disimpan manual | Aman, asinkron | EncryptedSharedPreferences (sudah tidak dianjurkan) |
| Tanggal & jam | **java.time** (`LocalDate`, `LocalTime`, `ZoneId.of("Asia/Jakarta")`) | Bawaan sejak API 26 | kotlinx-datetime |
| Format Rupiah | `NumberFormat.getCurrencyInstance(Locale("id","ID"))` dengan `maximumFractionDigits = 0` | Meniru `Intl` web (lihat 3.12 #24) | – |
| Test | **JUnit 4/5** untuk logika murni; **Turbine** untuk Flow; Compose UI test opsional | Contoh uji Bagian 3 dijadikan unit test | Kotest |
| Build | Gradle Kotlin DSL + **version catalog** (`libs.versions.toml`) | Standar template Android Studio | – |
| Rahasia | `local.properties` → `BuildConfig` (lewat Secrets Gradle Plugin atau `buildConfigField`) | Kunci tidak masuk Git | – |

**minSdk 26** (Android 8.0): `java.time` tersedia tanpa desugaring dan mencakup hampir semua HP aktif di Indonesia. Kalau harus mendukung HP lebih tua, turunkan ke 24 dan aktifkan *core library desugaring*. **targetSdk/compileSdk**: versi terbaru yang didukung Android Studio saat proyek dibuat.

Struktur paket/folder yang disarankan (nama paket contoh `id.desara.admin`; tanyakan ke pemilik):

```
app/src/main/java/id/desara/admin/
├── DesaraApp.kt                  // Application: inisialisasi Koin & Supabase
├── MainActivity.kt               // satu Activity, setContent { DesaraTheme { NavHost } }
├── core/
│   ├── supabase/SupabaseModule.kt    // createSupabaseClient(url, anonKey) dari BuildConfig
│   ├── di/AppModule.kt               // modul Koin
│   ├── format/Rupiah.kt              // formatRupiah()
│   ├── format/Waktu.kt               // normalizeTime, format tanggal id-ID, zona Asia/Jakarta
│   ├── format/WhatsApp.kt            // cleanPhone, buildWaUrl
│   └── error/RpcError.kt             // parse "KODE: pesan" dari RPC
├── data/
│   ├── model/                        // DTO @Serializable: Booking, BookingAddon, Addon, Package, Category, WaitingList, WisudaEvent, SettingsMap
│   ├── repo/AuthRepository.kt
│   ├── repo/BookingRepository.kt     // query + panggilan RPC booking
│   ├── repo/KatalogRepository.kt     // kategori, paket, add-on, addon_categories
│   ├── repo/WaitingListRepository.kt
│   └── repo/SettingsRepository.kt
├── domain/                           // logika MURNI (tanpa Android), di-unit-test dengan contoh uji
│   ├── AddonCalc.kt                  // getMenitPerUnit, labelSatuanWaktu, hitung*, sisaKuota, ringkasanSetelah (pratinjau UI)
│   ├── StatusRules.kt                // transisi yang diizinkan (untuk menampilkan/menyembunyikan tombol)
│   ├── SlotRules.kt                  // isSlotWithinOperatingHours, pengelompokan Pagi/Siang/Sore
│   ├── WaitingListParser.kt          // parseWaitingListInfo
│   └── WaTemplates.kt                // 4 template WhatsApp
├── ui/
│   ├── theme/ (Color.kt, Type.kt, Shape.kt, Theme.kt)
│   ├── components/ (StatusBadge, CetakBadge, InfoChip, ClientCard, ConfirmDialog, EmptyState, ErrorState, LoadingState)
│   └── feature/
│       ├── login/
│       ├── booking/ (daftar, filter, timeline, detail)
│       ├── addonlapangan/
│       ├── cetak/
│       ├── whatsapp/
│       ├── reschedule/
│       ├── waitinglist/ (+ konversi)
│       ├── wisuda/
│       ├── katalog/ (kategori, paket, add-on)
│       └── pengaturan/
└── navigation/AppNavHost.kt
app/src/test/java/id/desara/admin/domain/   // unit test contoh uji Bagian 3
```

Prinsip: perhitungan yang **mengubah data** (harga, durasi, status, kuota) dijalankan di **RPC database** (2.6). Kode `domain/` di Android hanya dipakai untuk **tampilan dan pratinjau**. Hasil akhir selalu diambil ulang dari database setelah RPC berhasil.

---

## LAMPIRAN A — MATRIKS PARITAS FITUR ADMIN

| Fitur | Ada di Web | Prioritas Android | Catatan |
|---|---|---|---|
| Login / logout admin | Ya | Wajib | Supabase Auth email+password |
| Daftar booking + filter (cari, status, cetak, tanggal) | Ya | Wajib | Pakai zona Asia/Jakarta untuk "Hari Ini" |
| Kalender jumlah booking per tanggal | Ya | Sebaiknya | Hitung non-`dibatalkan` |
| Ubah status booking (konfirmasi/selesai/batal) | Ya | Wajib | Tegakkan tabel 3.7; idealnya RPC |
| Hapus booking permanen | Ya | Sebaiknya | File bukti tidak bisa dihapus dengan sesi admin |
| Lihat bukti transfer (signed URL) | Ya | Sebaiknya | Hanya data lama |
| Status cetak (Belum/Proses/Selesai) + filter | Ya | Wajib | Perbaiki log (`status_ke` tidak boleh NULL) |
| Add-on di lapangan (tambah) | Ya | Wajib | RPC `terapkan_addon_lapangan` + rumus 3.8 |
| Koreksi add-on lapangan (kurangi/hapus) | Ya | Wajib | Sama |
| Reschedule & ganti paket | Ya | Wajib | Idealnya RPC; baca jam dari settings |
| Template WhatsApp (4 jenis) | Ya | Wajib | Teks 4.5 persis |
| Waiting list: daftar, tandai, hapus, WA | Ya | Wajib | `catatan` harus di-parse (3.10) |
| Konversi waiting list → booking | Ya | Wajib | Idealnya RPC |
| CRUD acara wisuda | Ya | Wajib | Butuh policy RLS baru atau RPC |
| Kategori & paket (CRUD) | Ya | Sebaiknya | Jangan menimpa `jumlah_foto_edit` dengan null |
| Add-on master (CRUD, menit per unit, kategori) | Ya | Sebaiknya | |
| Pengaturan studio (info, kontak, DP, jam, interval) | Ya | Sebaiknya | |
| Background + upload foto contoh | Ya | Sebaiknya | Policy bucket `backgrounds` TIDAK JELAS |
| Tanggal tutup (closed_dates) | Ya | Wajib | Mempengaruhi slot |
| Riwayat `booking_status_log` | Data ada, **tidak ditampilkan di web** | Tidak perlu (opsional) | |
| Timeline hari ini | Ya | Wajib | Lihat 4.2 |
| Wizard booking / pricelist / waiting list publik | Ya (publik) | Tidak perlu | Android khusus admin |

---

## DAFTAR HAL TIDAK JELAS

| # | Hal | File/tempat yang perlu dicek |
|---|---|---|
| 1 | Bucket `backgrounds`: publik/privat dan policy-nya (tidak ada di migrasi) | Supabase Dashboard › Storage; `actions.ts › uploadBackgroundImage` |
| 2 | Tipe kolom `bookings.status_cetak` di produksi (TEXT/enum/lainnya) dan kapan dibuat | Supabase Dashboard › Table editor `bookings`; tidak ada di 001–004 |
| 3 | Apakah migrasi 005 (versi lama atau baru) sudah dijalankan di produksi | Supabase SQL: `SELECT column_name FROM information_schema.columns WHERE table_name='addons'` |
| 4 | Apakah sign-up publik Supabase Auth dimatikan, dan bagaimana akun admin dibuat | Supabase Dashboard › Authentication |
| 5 | Apakah key `admin_email` ada di tabel `settings` dan untuk apa | Tabel `settings`; policy `settings_public_read` (001) |
| 6 | Apakah baris kosong di template WA sengaja dibuang (`.filter(Boolean)` membuang `''`) atau bug | `WhatsAppTemplateModal.tsx › getMessageText` |
| 7 | Reschedule web mendorong `booking.jam_mulai` mentah (`"HH:MM:SS"`) ke daftar slot `"HH:MM"`; apakah jam lama tampil ganda/tidak terpilih di UI | `RescheduleModal.tsx` (efek `getAvailableSlots`, ± baris 95–115) |
| 8 | Isi detail `AdminCalendarPicker` (indikator per tanggal) | `src/components/admin/AdminCalendarPicker.tsx` |
| 9 | Kebijakan untuk `waiting_list.jam_ingin`, `kampus`, `dp_dibayar` (kolom ada tetapi tidak ditulis) | `002_waiting_list_updates.sql`, `actions.ts › submitWaitingList` |
| 10 | Apakah `MAX_BOOKING_PER_SLOT` di-set lewat env di server produksi | Environment hosting (Vercel/lainnya) |
| 11 | Apakah pengecekan tumpang tindih durasi memang sengaja tidak dipakai (hanya jam mulai sama) | `utils.ts › isSlotBlocked` (komentar "ATURAN BARU") |
| 12 | Penanganan wisuda: apakah slot acara wisuda juga harus memblokir booking biasa | `actions.ts › getWisudaSlotStatus`, `submitWaitingList` |
| 13 | Apakah booking `selesai` di timeline memang berlabel "Menunggu" (kemungkinan bug kecil) | `BookingsClient.tsx`, bagian "Timeline Jadwal Harian" |
| 14 | Nama paket aplikasi Android (`applicationId`), nama aplikasi di HP, dan apakah perlu tema gelap | Keputusan pemilik |
| 15 | Apakah RPC R4 (`ubah_jadwal_booking`) boleh menambah cek tanggal tutup & jam operasional (web saat ini TIDAK mengecek) | Keputusan pemilik; `actions.ts › updateBookingSchedule` |


## DAFTAR RPC & PERUBAHAN DATABASE YANG BELUM ADA

Status per 9 Oktober 2026. Detail parameter, nilai kembalian, dan kode error ada di 2.6.

| # | Nama | Jenis | Dibutuhkan Android pada tahap |
|---|---|---|---|
| R0 | `terapkan_addon_lapangan` | RPC, **ADA di file migrasi 005**. Pastikan migrasi sudah dijalankan di produksi | Tahap 4 (sementara, sampai R5/R6 ada) |
| R1 | `ubah_status_booking` | RPC, BELUM | Tahap 3 |
| R2 | `ubah_status_cetak` | RPC, BELUM | Tahap 5 |
| R3 | `get_available_slots` | RPC, BELUM | Tahap 6 |
| R4 | `ubah_jadwal_booking` | RPC, BELUM | Tahap 6 |
| R5 | `tambah_addon_lapangan` | RPC, BELUM | Tahap 4 |
| R6 | `kurangi_addon_lapangan` | RPC, BELUM | Tahap 4 |
| R7 | `konversi_waiting_list` | RPC, BELUM | Tahap 7 |
| P1 | Policy `wisuda_events_admin_write` | RLS, BELUM | Tahap 7 |
| P2 | Policy storage `allow_admin_delete` (`bukti-transfer`) | Storage, BELUM | Tahap 3 (hapus booking yang punya bukti) |
| P3 | Policy storage `backgrounds` untuk admin | Storage, TIDAK JELAS | Tahap 8 |
| P4 | Matikan sign-up publik | Pengaturan Supabase | Sebelum rilis |
