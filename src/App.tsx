import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { SyncProvider, useSync } from './context/SyncContext.tsx';
import { Navbar, ActiveTab } from './components/common/Navbar.tsx';
import { LoginModal } from './components/common/LoginModal.tsx';
import { AttendancePortalView } from './components/portal/AttendancePortalView.tsx';
import { StudentKioskView } from './components/kiosk/StudentKioskView.tsx';
import { HomeroomDashboard } from './components/homeroom/HomeroomDashboard.tsx';
import { CounselingDashboard } from './components/counseling/CounselingDashboard.tsx';
import { TeacherAttendanceView } from './components/teacher/TeacherAttendanceView.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';
import { ErrorPage } from './components/common/ErrorPage.tsx';

function MainApp() {
  const { user, isAuthenticated } = useAuth();
  const { syncStatus, offlineQueueCount } = useSync();

  const [activeTab, setActiveTab] = useState<ActiveTab>('portal');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginInitialMode, setLoginInitialMode] = useState<'select' | 'teacher' | 'admin'>('select');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    }
    return false;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync dark mode with HTML root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Error attempting to enable fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(console.warn);
      }
    }
  };

  const handleOpenLogin = (mode: 'select' | 'teacher' | 'admin' = 'select') => {
    setLoginInitialMode(mode);
    setIsLoginModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={tab => setActiveTab(tab)}
        onOpenLoginModal={mode => handleOpenLogin(mode || 'select')}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Mode Switcher Bar: Pilihan Presensi Siswa & Presensi Guru */}
      <div className="bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 py-2.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              Pilihan Presensi:
            </span>
            <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveTab('portal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                  activeTab === 'portal'
                    ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🏠 Menu Pilihan</span>
              </button>

              <button
                onClick={() => setActiveTab('kiosk')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                  activeTab === 'kiosk'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-blue-600'
                }`}
              >
                <span>🎓 Presensi Siswa</span>
                <span className="text-[10px] opacity-75 font-normal">(Kiosk)</span>
              </button>

              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    handleOpenLogin('teacher');
                  } else {
                    setActiveTab('teacher');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                  activeTab === 'teacher'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                }`}
              >
                <span>👨‍🏫 Presensi Guru</span>
                <span className="text-[10px] opacity-75 font-normal">(Wajah + GPS)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAuthenticated ? (
              <button
                onClick={() => handleOpenLogin('admin')}
                className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              >
                <span>🛡️ Login Admin / Staf</span>
              </button>
            ) : (
              <span className="text-xs text-slate-500">
                Login sebagai: <strong>{user?.name}</strong> ({user?.role})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Offline Alert Banner */}
      {syncStatus === 'offline' && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>
            Mode Offline Aktif — Presensi akan disimpan di antrian IndexedDB lokal{' '}
            {offlineQueueCount > 0 ? `(${offlineQueueCount} tersimpan)` : ''} dan otomatis disinkronkan saat terhubung kembali.
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-12">
        {activeTab === 'portal' && (
          <AttendancePortalView
            onSelectStudentKiosk={() => setActiveTab('kiosk')}
            onSelectTeacherAttendance={() => {
              if (isAuthenticated) {
                setActiveTab('teacher');
              } else {
                handleOpenLogin('teacher');
              }
            }}
            onOpenAdminLogin={() => handleOpenLogin('admin')}
            onOpenTeacherLogin={() => handleOpenLogin('teacher')}
          />
        )}

        {activeTab === 'kiosk' && (
          <StudentKioskView onReturnToPortal={() => setActiveTab('portal')} />
        )}

        {activeTab === 'homeroom' && (
          isAuthenticated ? (
            <HomeroomDashboard />
          ) : (
            <div className="max-w-md mx-auto mt-20 text-center p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Akses Terbatas: Wali Kelas</h3>
              <p className="text-xs text-slate-500">Silakan login menggunakan akun wali kelas untuk melihat data kelas.</p>
              <button
                onClick={() => handleOpenLogin('admin')}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                Login Wali Kelas
              </button>
            </div>
          )
        )}

        {activeTab === 'counseling' && (
          isAuthenticated ? (
            <CounselingDashboard />
          ) : (
            <div className="max-w-md mx-auto mt-20 text-center p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Akses Terbatas: BK & Kesiswaan</h3>
              <p className="text-xs text-slate-500">Silakan login menggunakan akun BK / Kesiswaan.</p>
              <button
                onClick={() => handleOpenLogin('admin')}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                Login Petugas
              </button>
            </div>
          )
        )}

        {activeTab === 'teacher' && (
          isAuthenticated ? (
            <TeacherAttendanceView onReturnToPortal={() => setActiveTab('portal')} />
          ) : (
            <div className="max-w-md mx-auto mt-20 text-center p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Login Diperlukan</h3>
              <p className="text-xs text-slate-500">Silakan login sebagai guru untuk melakukan presensi masuk & pulang.</p>
              <button
                onClick={() => handleOpenLogin('teacher')}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                Login Guru
              </button>
            </div>
          )
        )}

        {activeTab === 'admin' && (
          isAuthenticated && user?.role === 'admin' ? (
            <AdminDashboard />
          ) : (
            <div className="max-w-md mx-auto mt-20 text-center p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Akses Administrator</h3>
              <p className="text-xs text-slate-500">Hanya akun dengan peran administrator yang dapat membuka panel ini.</p>
              <button
                onClick={() => handleOpenLogin('admin')}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                Login Admin
              </button>
            </div>
          )
        )}
      </main>

      {/* Login Modal with Presensi Siswa & Presensi Guru Choice */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        initialMode={loginInitialMode}
        onSelectStudentKiosk={() => setActiveTab('kiosk')}
        onSuccess={() => setActiveTab(loginInitialMode === 'admin' ? 'admin' : 'teacher')}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <MainApp />
      </SyncProvider>
    </AuthProvider>
  );
}
