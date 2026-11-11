import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  X,
  Lock,
  User,
  AlertCircle,
  KeyRound,
  GraduationCap,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  QrCode,
  ShieldCheck,
  MapPin,
  Camera,
} from 'lucide-react';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStudentKiosk?: () => void;
  onSuccess?: () => void;
  initialMode?: 'select' | 'teacher' | 'admin';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSelectStudentKiosk,
  onSuccess,
  initialMode = 'select',
}) => {
  const { login } = useAuth();
  const [viewMode, setViewMode] = useState<'select' | 'teacher' | 'admin'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync initialMode if modal reopens
  React.useEffect(() => {
    if (isOpen) {
      setViewMode(initialMode);
      setError(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Harap isi username dan password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await login(username, password);
    setIsLoading(false);

    if (res.success) {
      onClose();
      onSuccess?.();
    } else {
      setError(res.error || 'Username atau password salah.');
    }
  };

  const handleQuickDemo = (demoUser: string, demoPass: string) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setError(null);
  };

  const handleChooseStudentKiosk = () => {
    onSelectStudentKiosk?.();
    onClose();
  };

  const getModalTitle = () => {
    if (viewMode === 'select') return 'Pilihan Presensi & Login';
    if (viewMode === 'admin') return 'Login Administrator & Staf';
    return 'Login Presensi Guru';
  };

  const getModalSubtitle = () => {
    if (viewMode === 'select') return 'Pilih mode presensi atau login yang ingin Anda gunakan';
    if (viewMode === 'admin') return 'Masuk ke panel manajemen Administrator, Wali Kelas, atau BK';
    return 'Masuk untuk melakukan presensi masuk & pulang guru';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-sm">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {getModalTitle()}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getModalSubtitle()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* VIEW 1: PILIHAN PRESENSI SISWA, PRESENSI GURU, ATAU LOGIN ADMIN */}
        {viewMode === 'select' ? (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Silakan pilih menu:
            </p>

            {/* OPSI 1: PRESENSI SISWA */}
            <button
              type="button"
              onClick={handleChooseStudentKiosk}
              className="w-full group relative p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-900 hover:border-blue-600 dark:hover:border-blue-500 bg-gradient-to-r from-blue-50/50 via-white to-white dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900 text-left transition-all hover:shadow-md flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 flex-shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      Presensi Siswa
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Tanpa Sandi
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kiosk layar sentuh deteksi wajah & scan kartu barcode/RFID
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-2" />
            </button>

            {/* OPSI 2: PRESENSI GURU */}
            <button
              type="button"
              onClick={() => {
                setViewMode('teacher');
                setUsername('guru1');
                setPassword('guru123');
              }}
              className="w-full group relative p-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900 hover:border-indigo-600 dark:hover:border-indigo-500 bg-gradient-to-r from-indigo-50/50 via-white to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 text-left transition-all hover:shadow-md flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20 flex-shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      Presensi Guru
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Wajah & GPS
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Presensi masuk & pulang mandiri guru dengan kamera & GPS
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-2" />
            </button>

            {/* OPSI 3: LOGIN ADMIN & STAF */}
            <button
              type="button"
              onClick={() => {
                setViewMode('admin');
                setUsername('admin');
                setPassword('admin123');
              }}
              className="w-full group relative p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-slate-600 dark:hover:border-slate-500 bg-gradient-to-r from-slate-50 via-white to-white dark:from-slate-800/40 dark:via-slate-900 dark:to-slate-900 text-left transition-all hover:shadow-md flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center font-bold shadow-md flex-shrink-0">
                  <ShieldCheck className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      Login Admin & Staf
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                      Admin • Wali • BK
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Dashboard rekap wali kelas, radar BK/kesiswaan, dan kelola sistem
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 transition-transform flex-shrink-0 ml-2" />
            </button>
          </div>
        ) : (
          /* VIEW 2: FORM LOGIN (GURU ATAU ADMIN/STAF) */
          <div className="mt-4 space-y-4 animate-in fade-in">
            <button
              type="button"
              onClick={() => setViewMode('select')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Pilihan Presensi</span>
            </button>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Contoh: guru1 / wali1 / admin"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {isLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {viewMode === 'admin' ? 'Masuk ke Panel Admin / Staf' : 'Masuk ke Presensi Guru'}
              </button>
            </form>

            {/* Quick Demo Credentials for Testing */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
                Akun Demo Cepat:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('guru1', 'guru123')}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-left transition"
                >
                  <div className="font-semibold text-slate-900 dark:text-white">Guru Mapel</div>
                  <div className="text-[10px] text-slate-500">guru1 / guru123</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('wali1', 'guru123')}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-left transition"
                >
                  <div className="font-semibold text-slate-900 dark:text-white">Wali Kelas</div>
                  <div className="text-[10px] text-slate-500">wali1 / guru123</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('bk1', 'bk123')}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-left transition"
                >
                  <div className="font-semibold text-slate-900 dark:text-white">Guru BK</div>
                  <div className="text-[10px] text-slate-500">bk1 / bk123</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('admin', 'admin123')}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-left transition"
                >
                  <div className="font-semibold text-slate-900 dark:text-white">Admin</div>
                  <div className="text-[10px] text-slate-500">admin / admin123</div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
