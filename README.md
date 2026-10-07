# Desara Home Studio – Booking System

Sistem booking studio foto untuk Desara Home Studio, Pontianak. Dibangun dengan Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, dan Supabase.

---

## Fitur Utama

### 1. Halaman Klien (1-Page Animated Wizard – 7 Langkah)
1. **Welcome**: Sambutan hangat, jam operasional dinamis, tombol *Mulai Booking* & *Waiting List*.
2. **Nama**: Input nama klien dengan animasi transisi.
3. **Kategori**: Pilihan kategori sesi foto (Wisuda, Prewedding, Keluarga, Group, Portrait).
4. **Pricelist Paket**: Daftar paket terstruktur (durasi, jumlah background, maks orang, cetak ukuran & jumlah, foto edit, bonus).
5. **Form Booking & Add-on**:
   - Pilihan background interaktif (sesuai kuota paket + add-on).
   - Nomor WhatsApp & kampus/instansi.
   - Pilihan tanggal & slot jam real-time (hanya slot kosong yang tampil, terhitung otomatis berdasarkan durasi paket + add-on waktu).
   - Stepper penambahan add-on (waktu, background, orang, cetak).
   - Total harga dinamis.
6. **Pembayaran DP**: Ringkasan rincian biaya, nomor rekening BRI dengan tombol 1-klik salin, input nominal DP (minimal tervalidasi), upload bukti transfer opsional ke Supabase Storage.
7. **Sukses**: Kode booking unik (`DSR-YYYYMMDD-XXX`), ringkasan, dan tombol 1-klik konfirmasi otomatis ke WhatsApp Admin.

### 2. Waiting List
- Form khusus saat slot penuh atau ingin antre sesi.
- Notifikasi langsung & tersimpan di database.

### 3. Admin Dashboard (`/admin`)
- **Autentikasi**: Proteksi rute berbasis Supabase Auth & Next.js Middleware.
- **Booking**:
  - Filter status (Menunggu, Dikonfirmasi, Selesai, Dibatalkan).
  - Pencarian nama dan kode booking.
  - Kalender jadwal per hari.
  - Alur status satu arah (*pending* ➔ *booking* ➔ *selesai*, atau *dibatalkan*). Slot otomatis terbuka kembali jika dibatalkan.
  - Riwayat log perubahan status tercatat di tabel `booking_status_log`.
  - Tombol WhatsApp klien siap kirim.
- **Waiting List**: Daftar peminat antrean, tombol tandai sudah dihubungi, dan link WhatsApp langsung.
- **Kategori & Paket**: CRUD lengkap, urutan, durasi, background, kapasitas orang, ukuran cetak, bonus.
- **Add-on**: CRUD 4 jenis add-on (waktu, background, orang, cetak), harga per satuan, batas maksimal, dan toggle aktif per kategori.
- **Pengaturan**: Edit nama studio, nomor WA admin, rekening BRI & nama pemilik, DP minimal, daftar varian background studio, jam operasional buka/tutup, dan toggle tombol waiting list.

---

## Panduan Setup Supabase

### 1. Buat Proyek Supabase
1. Masuk ke [supabase.com](https://supabase.com) dan buat proyek baru.
2. Buka menu **SQL Editor**.

### 2. Jalankan Migrasi & Seed Data
1. Salin isi file `supabase/migrations/001_initial.sql` dan jalankan (Run) di SQL Editor. Ini akan membuat tabel, trigger kode booking, RLS policies, dan storage bucket.
2. Salin isi file `supabase/seed.sql` dan jalankan (Run) untuk memasukkan data awal kategori, paket Wisuda (Bronze & Silver), add-on, dan konfigurasi studio.

### 3. Buat Akun Admin
1. Di dashboard Supabase, buka tab **Authentication** ➔ **Users**.
2. Klik **Add User** ➔ **Create user**. Masukkan email admin dan password.

### 4. Konfigurasi Environment Variables
Buat file `.env.local` di root proyek:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-dari-supabase-api-settings>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-dari-supabase-api-settings>
```

---

## Menjalankan di Lokal

```bash
# Install dependensi (jika belum)
npm install

# Jalankan server development
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) untuk halaman klien, dan [http://localhost:3000/admin](http://localhost:3000/admin) untuk dashboard admin.

---

## Panduan Deploy ke Vercel

1. Push repositori ini ke GitHub / GitLab.
2. Buka [vercel.com](https://vercel.com) dan pilih **Import Project**.
3. Di bagian **Environment Variables**, tambahkan ketiga variabel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Klik **Deploy**.
