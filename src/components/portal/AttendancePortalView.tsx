import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Briefcase,
  Shield,
  Clock,
  ArrowRight,
  QrCode,
  MapPin,
  Camera,
  Users,
  CheckCircle2,
  Sparkles,
  Lock,
  HeartHandshake,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSync } from '../../context/SyncContext.tsx';

interface AttendancePortalViewProps {
  onSelectStudentKiosk: () => void;
  onSelectTeacherAttendance: () => void;
  onOpenAdminLogin: () => void;
  onOpenTeacherLogin: () => void;
}

export const AttendancePortalView: React.FC<AttendancePortalViewProps> = ({
  onSelectStudentKiosk,
  onSelectTeacherAttendance,
  onOpenAdminLogin,
  onOpenTeacherLogin,
}) => {
  const { user, isAuthenticated } = useAuth();
  const { settings, todayAttendance, activePermits } = useSync();

  // Clock state
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTeacherClick = () => {
    if (isAuthenticated) {
      onSelectTeacherAttendance();
    } else {
      onOpenTeacherLogin();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-200">
      {/* Hero Welcome & Live Realtime Clock */}
      <div className="relative rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white shadow-xl overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-48 h-48 rounded-full bg-blue-500/10 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Portal Terpadu Presensi Sekolah</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              {settings?.schoolName || 'Yayasan Mambaul Ulum'}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-xl">
              Pilih portal presensi di bawah untuk memulai. Presensi siswa menggunakan deteksi wajah di kamera dan scan kartu/RFID, presensi guru menggunakan validasi wajah & lokasi GPS.
            </p>
          </div>

          {/* Clock Widget */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[200px]">
            <div className="flex items-center justify-center gap-1.5 text-xs text-blue-200 font-semibold mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{currentDate}</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
              {currentTime || '--:--:--'}
            </div>
            <div className="mt-2 text-[10px] text-blue-200">
              Batas Hadir Tepat Waktu: <strong>{settings?.lateCutoffTime} WIB</strong>
            </div>
          </div>
        </div>

        {/* Live Quick Counter Badges */}
        <div className="mt-8 pt-6 border-t border-white/15 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Presensi Hari Ini: <strong>{todayAttendance.length} Siswa</strong></span>
          </div>
          {activePermits.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/30">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Sedang di Toilet: <strong>{activePermits.length} Siswa</strong></span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs">
            <span>Tahun Ajaran: <strong>{settings?.academicYear}</strong></span>
          </div>
        </div>
      </div>

      {/* Main 3 Options: Presensi Siswa, Presensi Guru, Login Admin */}
      <div className="space-y-4">
        <div className="text-center md:text-left space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Pilih Menu Presensi & Akses Akun
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Silakan pilih modul yang sesuai dengan kebutuhan Anda saat ini:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* PILIHAN 1: PRESENSI SISWA */}
          <div className="group relative flex flex-col justify-between p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-900/60 hover:border-blue-600 dark:hover:border-blue-500 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/30">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  Kiosk Publik (Tanpa Sandi)
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  Presensi Siswa
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Layar utama presensi siswa dengan kamera deteksi wajah dan pencocokan kartu barcode/RFID.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Deteksi Wajah Real-time (Privasi Aman)</span>
                </div>
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Scan Kartu Barcode / RFID Hardware</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Fitur Izin ke Toilet & Presensi Manual</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                type="button"
                onClick={onSelectStudentKiosk}
                className="w-full py-3.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-2"
              >
                <span>Mulai Presensi Siswa</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* PILIHAN 2: PRESENSI GURU & PEGAWAI */}
          <div className="group relative flex flex-col justify-between p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-600 dark:hover:border-indigo-500 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/30">
                  <Briefcase className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300">
                  Wajah & GPS Geofence
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                  Presensi Guru & Pegawai
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Presensi masuk dan pulang mandiri guru dengan verifikasi biometric wajah dan radius koordinat sekolah.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span>Validasi Lokasi GPS & Radius Titik Sekolah</span>
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span>Verifikasi Wajah Masuk & Pulang</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span>Riwayat Kehadiran Pribadi & Izin/Sakit</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                type="button"
                onClick={handleTeacherClick}
                className="w-full py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2"
              >
                <span>{isAuthenticated ? 'Buka Presensi Guru' : 'Masuk Presensi Guru'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* PILIHAN 3: LOGIN ADMIN & STAF MANAJEMEN */}
          <div className="group relative flex flex-col justify-between p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-600 dark:hover:border-slate-500 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center font-bold shadow-md">
                  <Shield className="w-7 h-7 text-blue-400" />
                </div>
                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                  Admin • Wali • BK
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  Login Admin & Staf
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Panel manajemen sekolah untuk Administrator, Wali Kelas (rekap kelas), dan Guru BK/Kesiswaan (radar siswa).
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span>Pengaturan Sekolah, Jam & Toleransi</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span>Manajemen Kelas, Siswa & Naik Kelas</span>
                </div>
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span>Radar Pelanggaran & Tindak Lanjut BK</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                type="button"
                onClick={onOpenAdminLogin}
                className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-98 text-white text-sm font-bold shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>Login Administrator / Staf</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
