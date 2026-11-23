# Ruang Sehat — Portal Self-Assessment Khaula Afifah

Frontend web untuk tugas UTS Self-Assessment Telehealth. Aplikasi ini hanya berperan sebagai **portal pasien**; proses penyimpanan, validasi, hasil, status, klarifikasi, dan tindak lanjut disediakan oleh API dosen.

## Menjalankan aplikasi
1. Extract folder project.
2. Buka folder `telehealth-self-assessment` di VS Code.
3. Jalankan `index.html` dengan Live Server (disarankan).
4. Buka menu **Pengaturan**.
5. Identitas awal sudah diisi untuk Khaula Afifah (C2C023174, Informatika E). Pilih akun pasien yang ditetapkan dosen dan masukkan token pasangannya.
6. Klik **Simpan & Uji Koneksi**.

Bisa juga dibuka dengan klik dua kali `index.html`, tetapi Live Server lebih disarankan untuk menghindari pembatasan origin browser saat `fetch` ke API.

## Fitur
- Identitas mahasiswa dan konfigurasi token.
- Dashboard pasien: profil, statistik, daftar aktivitas.
- Daftar formulir dinamis dari `GET /forms`.
- Petunjuk dan persetujuan dari definisi formulir.
- Pengisian per bagian, `show_if`, tipe pertanyaan, simpan draft.
- Validasi sebelum submit dan ringkasan jawaban.
- Kirim assessment, riwayat, hasil, tracking status.
- Jawab klarifikasi dan lihat tindak lanjut.
- Bukti fitur UTS melalui `GET /uts/{nim}`.

## API
Base URL: `https://telehealth.informatikaunimus.site/api`

Token dikirim sebagai header `Authorization: Bearer <token>` pada request yang membutuhkan autentikasi. Data pasien difilter dengan NIM pada endpoint profil dan riwayat.

## Catatan keamanan
Token disimpan di `localStorage` browser agar praktis untuk tugas lokal. Token frontend **bukan rahasia**: pengguna browser dapat melihatnya melalui DevTools. Jangan deploy aplikasi dengan token tertanam, jangan commit token ke Git, dan jangan unggah token ke repository publik. Gunakan hanya token yang dibagikan dosen untuk kegiatan perkuliahan.

## Catatan pengujian
Kode ini disusun mengikuti dokumentasi API yang diberikan. Keberhasilan integrasi tetap harus diuji pada server aktif dengan token yang valid. Klarifikasi dan tindak lanjut baru muncul setelah dosen meninjau assessment.


## Identitas awal
- Nama: Khaula Afifah
- NIM: C2C023174
- Kelas: Informatika E

Token sengaja dikosongkan. Jangan memakai token milik teman. Minta konfirmasi dosen mengenai akun pasien dan token yang dialokasikan untukmu.

## Tema tampilan
Tema visual Ruang Sehat menggunakan mocha, caramel, cream, beige, dan sage. Struktur dan integrasi API dari starter project tetap dipertahankan; tampilan visual telah diubah.
