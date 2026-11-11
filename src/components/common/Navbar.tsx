import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSync } from '../../context/SyncContext.tsx';
import { SyncStatusBadge } from './SyncStatusBadge.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import {
  Maximize,
  Minimize,
  Moon,
  Sun,
  LogIn,
  LogOut,
  User as UserIcon,
  Shield,
  Layers,
  GraduationCap,
  Briefcase,
  HeartHandshake,
  Menu,
  X,
  LayoutGrid,
} from 'lucide-react';

export type ActiveTab = 'portal' | 'kiosk' | 'homeroom' | 'counseling' | 'teacher' | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenLoginModal: (mode?: 'select' | 'teacher' | 'admin') => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenLoginModal,
  darkMode,
  onToggleDarkMode,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings } = useSync();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Tab definitions with role restrictions
  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    requiresAuth?: boolean;
    allowedRoles?: string[];
  }> = [
    {
      id: 'portal',
      label: 'Menu Pilihan',
      icon: <LayoutGrid className="w-4 h-4" />,
    },
    {
      id: 'kiosk',
      label: 'Kiosk Siswa',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'teacher',
      label: 'Presensi Guru',
      icon: <Briefcase className="w-4 h-4" />,
      requiresAuth: true,
      allowedRoles: ['admin', 'guru', 'wali_kelas', 'bk', 'kesiswaan'],
    },
    {
      id: 'homeroom',
      label: 'Wali Kelas',
      icon: <GraduationCap className="w-4 h-4" />,
      requiresAuth: true,
      allowedRoles: ['admin', 'wali_kelas'],
    },
    {
      id: 'counseling',
      label: 'BK & Kesiswaan',
      icon: <HeartHandshake className="w-4 h-4" />,
      requiresAuth: true,
      allowedRoles: ['admin', 'bk', 'kesiswaan'],
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: <Shield className="w-4 h-4" />,
      requiresAuth: true,
      allowedRoles: ['admin'],
    },
  ];

  const handleTabClick = (item: typeof navItems[0]) => {
    if (item.requiresAuth && !isAuthenticated) {
      onOpenLoginModal(item.id === 'admin' ? 'admin' : 'teacher');
      return;
    }
    if (item.allowedRoles && user && !item.allowedRoles.includes(user.role)) {
      alert(`Akses terbatas: Menu ini hanya untuk peran ${item.allowedRoles.join(', ')}.`);
      return;
    }
    onSelectTab(item.id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & School Name - Clickable to go to Portal */}
          <button
            onClick={() => onSelectTab('portal')}
            className="flex items-center gap-3 text-left hover:opacity-90 transition group cursor-pointer"
            title="Kembali ke Menu Pilihan Presensi"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 flex-shrink-0 group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                {settings?.schoolName || 'Yayasan Mambaul Ulum'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block -mt-0.5">
                Presensi Digital Siswa & Guru
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              const hasRole = !item.allowedRoles || (user && item.allowedRoles.includes(user.role));
              if (item.requiresAuth && !isAuthenticated) {
                // Still show it so teachers/admins know where to click to login!
              } else if (item.requiresAuth && !hasRole) {
                return null; // Don't show if authenticated but wrong role
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Utilities & Auth */}
          <div className="flex items-center gap-2">
            <SyncStatusBadge />
            <PWAInstallButton />

            {/* Fullscreen toggle (Kiosk mode) */}
            <button
              onClick={onToggleFullscreen}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              title={isFullscreen ? 'Keluar Mode Layar Penuh' : 'Mode Layar Penuh (Kiosk)'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {/* Dark Mode toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Auth section */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="hidden lg:block text-right">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">{user.name}</div>
                  <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    {user.role.replace('_', ' ')}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectTab('portal')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl border border-blue-200 dark:border-blue-800 transition"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Pilihan Presensi</span>
                </button>

                <button
                  onClick={() => onOpenLoginModal('admin')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl shadow-sm transition"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Login Admin</span>
                </button>
              </div>
            )}

            {/* Mobile menu hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-4 space-y-1">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
