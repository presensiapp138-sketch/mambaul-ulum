import React from 'react';
import { AlertOctagon, Home, RefreshCw } from 'lucide-react';

interface ErrorPageProps {
  title?: string;
  message?: string;
  onReset?: () => void;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
  title = 'Halaman Tidak Ditemukan (404)',
  message = 'Halaman atau fitur yang Anda cari tidak tersedia atau sedang dalam pemeliharaan.',
  onReset,
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="inline-flex p-4 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
          <AlertOctagon className="w-12 h-12" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onReset && (
            <button
              onClick={onReset}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang
            </button>
          )}

          <a
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition"
          >
            <Home className="w-4 h-4" />
            Kembali ke Kiosk
          </a>
        </div>
      </div>
    </div>
  );
};
