# Sistem Presensi Siswa & Guru - Yayasan Mambaul Ulum (Google Sheets & Vercel)

Aplikasi web presensi digital modern, cerdas, dan lengkap untuk **Yayasan Mambaul Ulum**. Mendukung multi-jenjang pendidikan (**SMA/MA**, **SMP/MTS**, **SD/MI**), dilengkapi dengan deteksi wajah di sisi browser, scan barcode/RFID dengan auto-submit tanpa tombol Enter, mode kiosk layar penuh, validasi lokasi GPS guru, rekapitulasi wali kelas & BK, cetak kartu pelajar depan-belakang resolusi tinggi (.jpg & bulk .zip), serta sinkronisasi data ke Google Sheets dan Google Drive.

---

## 🌟 Fitur Unggulan

1. **Presensi Siswa (Mode Kiosk Publik - Tanpa Sandi)**
   - Deteksi semua wajah dalam frame kamera (frame diproses hanya di memori browser, tidak ada foto/video yang disimpan ke server demi privasi siswa).
   - Kamera responsif dan cepat dibuka dengan *background model preloading* dan inisialisasi paralel.
   - Pencocokan wajah otomatis dengan scan kartu barcode/QR/RFID fisik.
   - **Dukungan Alat Scan Eksternal**: Barcode scanner USB atau RFID reader otomatis terkirim (*auto-submit*) tanpa perlu menekan tombol Enter berkat deteksi input stream cerdas.
   - Deteksi keterlambatan otomatis berdasarkan jam batas toleransi sekolah.
   - Peringatan instan jika terdeteksi presensi ganda pada hari yang sama.
   - Presensi manual bagi petugas piket dengan pencatatan ke AuditLog.
   - Fitur "Izin ke Toilet" dengan timer berjalan dan peringatan jika melebihi batas waktu maksimal.

2. **Pusat Kustomisasi & Cetak Kartu Pelajar (Multi-Jenjang SMA/MA, SMP/MTS, SD/MI)**
   - **Foto Wajah Otomatis Berlatar Biru Resmi**: Siswa yang wajahnya didaftarkan di sistem otomatis memiliki pas foto berlatar belakang biru standar resmi madrasah/sekolah Indonesia (rasio 3:4) yang langsung terpasang rapi pada kartu pelajar.
   - **Barcode NISN Proporsional**: Posisi barcode dinaikkan dan diberi margin yang pas dari tepi bawah kartu sehingga tajam, mudah discan alat barcode/RFID, dan tidak terpotong saat dicetak atau dipotong.
   - **Upload Tanda Tangan Kepala Sekolah per Jenjang**: Administrator dapat mengunggah file tanda tangan kepala sekolah untuk masing-masing jenjang (SMA/MA, SMP/MTS, SD/MI) yang otomatis terisi ke kartu pelajar jenjang terkait.
   - **Ruang Kode QR Website Resmi di Belakang Kartu**: Sisi belakang kartu dilengkapi ruang khusus kode QR yang mengarah langsung ke website sekolah/yayasan (bisa auto-generate dari URL atau upload gambar QR khusus).
   - **Logo Sekolah & Watermark Kartu**: Mendukung upload logo resmi sekolah/madrasah per jenjang serta watermark transparan yayasan yang otomatis menyesuaikan ukuran kartu depan dan belakang.
   - **Alamat & Website Fleksibel**: Alamat dan website yayasan/sekolah dapat diubah secara dinamis baik pada aplikasi presensi maupun pada kartu pelajar.
   - **Format Unduhan JPG & ZIP**:
     - Unduh satuan kartu depan/belakang dalam format **JPG 300 DPI** berkualitas tinggi siap cetak.
     - Unduh massal (*bulk download*) seluruh siswa per kelas atau per jenjang dalam satu berkas **.ZIP** lengkap dengan progress bar.

3. **Multi-Jenjang Pendidikan Terpadu**
   - Mendukung 3 jenjang sekaligus dalam satu yayasan: **SMA/MA**, **SMP/MTS**, dan **SD/MI**.
   - Manajemen kelas dan data siswa terkelompok rapi per jenjang.

4. **Dashboard Wali Kelas**
   - Ringkasan kehadiran kelas hari ini (Hadir, Terlambat, Izin, Sakit, Alpa, Siswa di Toilet).
   - Rekap Harian, Pekanan, Bulanan, dan Perbandingan Antar Bulan.
   - Grafik interaktif tren kehadiran dan persentase kehadiran per siswa.
   - Koreksi status presensi dengan alasan audit.
   - Ekspor laporan ke Microsoft Excel (.xlsx) dan cetak PDF.

5. **Dashboard BK & Kesiswaan**
   - Radar otomatis deteksi dini siswa bermasalah (sering alpa, sering terlambat, sering izin toilet).
   - Label peringatan otomatis (Kuning / Merah).
   - Grafik perbandingan kehadiran antar kelas.
   - Pencatatan dan log tindak lanjut bimbingan konseling (BK).

6. **Presensi Mandiri Guru (Login)**
   - Presensi Masuk & Pulang dengan verifikasi deteksi wajah + Geofence GPS.
   - Validasi radius sekolah (presensi ditolak jika berada di luar radius).
   - Riwayat kehadiran pribadi guru dan formulir pengajuan izin/sakit.

7. **Panel Administrator Utama**
   - Pengaturan jam masuk, batas terlambat, batas durasi toilet, dan toleransi pelanggaran.
   - Manajemen akun pengguna: Admin, Wali Kelas, Guru BK, Kesiswaan, Guru Mapel.
   - Pendaftaran Biometric Wajah (mengambil & menyimpan vektor matematika 128 float, tanpa gambar).
   - Pengaturan titik koordinat GPS dan radius sekolah.
   - Manajemen kelas, siswa, dan kenaikan kelas massal (*naik kelas*).
   - Upload massal data siswa dari file Excel/CSV beserta laporan baris yang gagal dan pencegahan duplikasi NIS.
   - Unduh template Excel siswa dan guru siap pakai.
   - Pusat Cetak Kartu Pelajar (JPG & ZIP).
   - Backup data ke Google Drive dan viewer Audit Log aktivitas.

8. **Sinkronisasi & Offline-First (PWA)**
   - Sinkronisasi cerdas dengan polling diff per 3-5 detik via ChangeLog.
   - Dukungan mode offline dengan penyimpanan antrian di IndexedDB dan kirim ulang otomatis saat internet pulih.
   - PWA Installable untuk dipasang sebagai aplikasi di Android, iOS, tablet, dan PC desktop.

---

## 🚀 Panduan Setup Google Service Account & Google Sheets

### Langkah 1: Buat Google Service Account
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat project baru (misal: `presensi-sekolah`).
3. Aktifkan API berikut di menu **APIs & Services > Library**:
   - **Google Sheets API**
   - **Google Drive API**
4. Masuk ke **IAM & Admin > Service Accounts**:
   - Klik **Create Service Account**.
   - Beri nama (misal: `presensi-bot`).
   - Beri peran (*Role*): **Editor**.
   - Klik **Done**.
5. Klik pada Service Account yang baru dibuat, buka tab **Keys**:
   - Klik **Add Key > Create New Key > Pilih JSON > Create**.
   - File JSON akan terunduh ke komputer Anda. Buka file tersebut dengan text editor.
   - Anda akan membutuhkan:
     - `client_email` (contoh: `presensi-bot@project-id.iam.gserviceaccount.com`)
     - `private_key` (teks panjang yang diawali `-----BEGIN PRIVATE KEY-----`)

### Langkah 2: Buat Google Spreadsheet
1. Buka [Google Sheets](https://sheets.new) dan buat spreadsheet baru (misal: `Database_Presensi_Sekolah`).
2. Klik tombol **Bagikan (Share)** di pojok kanan atas:
   - Masukkan email Service Account (`client_email`) dari langkah 1.
   - Berikan hak akses **Editor**.
   - Hapus centang "Kirim notifikasi" lalu klik **Kirim**.
3. Salin **Spreadsheet ID** dari URL browser:
   - Format: `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

### Langkah 3: (Opsional) Buat Folder Google Drive
1. Buka [Google Drive](https://drive.google.com).
2. Buat folder baru (misal: `Presensi_Drive_Backup`).
3. Bagikan folder tersebut ke email Service Account dengan akses **Editor**.
4. Salin **Folder ID** dari URL browser.

---

## ⚙️ Daftar Environment Variables

Salin file `.env.example` menjadi `.env` atau atur pada dashboard hosting Anda (Vercel):

```env
# Email service account dari file JSON key
GOOGLE_SERVICE_ACCOUNT_EMAIL="presensi-bot@project-id.iam.gserviceaccount.com"

# Private key service account (gunakan newline \n jika diletakkan satu baris)
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC6...\n-----END PRIVATE KEY-----\n"

# ID dari Google Sheets yang telah di-share ke service account
SPREADSHEET_ID="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

# ID folder Google Drive untuk backup (opsional)
DRIVE_FOLDER_ID="1fO1_bZabcDEfgHIjkLMnoPQRstUVwxYZ"

# Kunci rahasia acak untuk enkripsi sesi JWT
JWT_SECRET="presensi_rahasia_sekolah_super_aman_2026_xyz"
```

> **Catatan Pengujian Awal:** Jika environment variable di atas belum diisi, aplikasi akan otomatis berjalan dalam **Simulated In-Memory Mode** dengan data contoh lengkap siap pakai, sehingga seluruh antarmuka dan alur presensi bisa langsung dicoba! Begitu environment variables diisi, tekan tombol **Init Google Sheets** di panel Admin untuk membuat seluruh tab dan kolom database secara otomatis.

---

## 📦 Akun Demo Bawaan

| Peran | Username | Password |
|---|---|---|
| **Administrator** | `admin` | `admin123` |
| **Wali Kelas (X RPL 1)** | `wali1` | `guru123` |
| **Guru BK** | `bk1` | `bk123` |
| **Kesiswaan** | `kesiswaan1` | `kesiswaan123` |
| **Guru Mapel** | `guru1` | `guru123` |

---

## 🚢 Langkah Deploy ke Vercel

1. Pastikan project memiliki file `vercel.json` dan `.npmrc` (sudah disertakan di repository).
2. Hubungkan repository GitHub Anda ke [Vercel](https://vercel.com).
3. Pada halaman konfigurasi project di Vercel:
   - **Framework Preset**: Pilih **Vite**.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Di bagian **Environment Variables**, tambahkan:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` (pastikan tanda kutip dan `\n` terbaca dengan benar)
   - `SPREADSHEET_ID`
   - `DRIVE_FOLDER_ID`
   - `JWT_SECRET`
5. Klik **Deploy**. Selesai! Aplikasi Anda siap digunakan 24/7 di sekolah.

---

## 🔒 Privasi Data Wajah Siswa

Aplikasi ini mematuhi standar privasi:
1. Tidak ada foto atau video wajah siswa yang pernah disimpan atau ditransmisikan ke server.
2. Kamera hanya diproses secara lokal di dalam GPU / RAM browser menggunakan model neural network TensorFlow di sisi klien.
3. Yang disimpan ke database hanyalah 128 angka koordinat matematis (*descriptor vector*) yang tidak dapat direkonstruksi kembali menjadi foto wajah asli.
