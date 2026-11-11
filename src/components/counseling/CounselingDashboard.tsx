import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  HeartHandshake,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  UserX,
  Phone,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSync } from '../../context/SyncContext.tsx';
import { ProblemStudent, FollowUpNote, SchoolClass, Student } from '../../types/index.ts';
import { apiRequest } from '../../lib/api.ts';
import { CardSkeleton, TableSkeleton } from '../common/Skeleton.tsx';

export const CounselingDashboard: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSync();

  const [problemStudents, setProblemStudents] = useState<ProblemStudent[]>([]);
  const [classComparison, setClassComparison] = useState<Array<{
    classId: string;
    className: string;
    attendanceRate: number;
    hadir: number;
    terlambat: number;
    alpa: number;
    totalStudents: number;
  }>>([]);
  const [followUpNotes, setFollowUpNotes] = useState<FollowUpNote[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Tabs: 'radar' | 'classes' | 'notes'
  const [activeTab, setActiveTab] = useState<'radar' | 'classes' | 'notes'>('radar');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New Note Modal
  const [showNoteModal, setShowNoteModal] = useState<boolean>(false);
  const [selectedStudentForNote, setSelectedStudentForNote] = useState<string>('');
  const [noteCategory, setNoteCategory] = useState<'Absensi' | 'Keterlambatan' | 'Toilet' | 'Perilaku' | 'Lainnya'>('Absensi');
  const [noteContent, setNoteContent] = useState<string>('');
  const [actionPlan, setActionPlan] = useState<string>('');
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [radarRes, recapRes, notesRes, clsRes, stdRes] = await Promise.all([
        apiRequest<ProblemStudent[]>('/api/reports/radar'),
        apiRequest<any>('/api/reports/recap'),
        apiRequest<FollowUpNote[]>('/api/counseling/notes'),
        apiRequest<SchoolClass[]>('/api/classes'),
        apiRequest<Student[]>('/api/students'),
      ]);

      if (radarRes.success && radarRes.data) setProblemStudents(radarRes.data);
      if (recapRes.success && recapRes.classSummaries) setClassComparison(recapRes.classSummaries);
      if (notesRes.success && notesRes.data) setFollowUpNotes(notesRes.data);
      if (clsRes.success && clsRes.data) setClasses(clsRes.data);
      if (stdRes.success && stdRes.data) setStudents(stdRes.data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Export Problem Students to Excel
  const handleExportRadar = () => {
    const rows = problemStudents.map((p, idx) => ({
      No: idx + 1,
      NIS: p.nis,
      'Nama Siswa': p.studentName,
      Kelas: p.className,
      'No HP Orang Tua': p.parentPhone || '-',
      'Peringatan Otomatis': p.warningLevel,
      'Total Alpa': p.alpaCount,
      'Total Terlambat': p.lateCount,
      'Izin Toilet Melebihi Batas': p.toiletExceededCount,
      'Rincian Masalah': p.issues.join('; '),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Radar_Siswa_BK');
    XLSX.writeFile(workbook, `Radar_BK_Kesiswaan_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Submit new Counseling Follow-up Note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForNote || !noteContent) return;

    setIsSubmittingNote(true);
    try {
      const res = await apiRequest('/api/counseling/notes', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudentForNote,
          category: noteCategory,
          notes: noteContent,
          actionPlan,
          status: 'Open',
        }),
      });

      if (res.success) {
        setShowNoteModal(false);
        setNoteContent('');
        setActionPlan('');
        await loadData();
      }
    } finally {
      setIsSubmittingNote(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
            <HeartHandshake className="w-4 h-4" />
            <span>Dashboard Bimbingan Konseling & Kesiswaan</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Pemantauan & Tindak Lanjut Siswa
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ambang Batas: Alpa ({settings?.warningThresholdAbsent}x) • Terlambat ({settings?.warningThresholdLate}x) • Toilet ({settings?.warningThresholdToilet}x)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNoteModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Catatan Tindak Lanjut</span>
          </button>

          <button
            onClick={handleExportRadar}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('radar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'radar'
              ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Radar Siswa Bermasalah ({problemStudents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('classes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'classes'
              ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Perbandingan Antar Kelas</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'notes'
              ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Riwayat Tindak Lanjut ({followUpNotes.length})</span>
        </button>
      </div>

      {/* Tab 1: Radar Siswa Bermasalah */}
      {activeTab === 'radar' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Daftar Deteksi Dini Siswa Butuh Pendampingan
              </h3>
              <p className="text-xs text-slate-500">
                Peringatan merah menandakan tingkat pelanggaran 2x lipat dari batas toleransi.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari siswa atau NIS..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-3">Tingkat</th>
                  <th className="py-3 px-3">Siswa & Kelas</th>
                  <th className="py-3 px-3">Rincian Pelanggaran</th>
                  <th className="py-3 px-3">Kontak Orang Tua</th>
                  <th className="py-3 px-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {problemStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Tidak ada siswa yang melebihi ambang batas toleransi. Kondisi aman!
                    </td>
                  </tr>
                ) : (
                  problemStudents
                    .filter(p => p.studentName.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(p => (
                      <tr key={p.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${
                              p.warningLevel === 'MERAH'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            {p.warningLevel}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{p.studentName}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.className} • NIS: {p.nis}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {p.issues.map((iss, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium"
                              >
                                {iss}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {p.parentPhone ? (
                            <a
                              href={`tel:${p.parentPhone}`}
                              className="flex items-center gap-1.5 hover:text-blue-600 transition"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{p.parentPhone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedStudentForNote(p.studentId);
                              setShowNoteModal(true);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 rounded-xl transition"
                          >
                            Buat Catatan BK
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Perbandingan Antar Kelas */}
      {activeTab === 'classes' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Tingkat Kehadiran Antar Kelas
            </h3>
            <p className="text-xs text-slate-500">
              Perbandingan persentase kehadiran dan jumlah alpa/terlambat di semua kelas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classComparison.map(cls => (
              <div
                key={cls.classId}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Kelas {cls.className}</h4>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                      cls.attendanceRate >= 90
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : cls.attendanceRate >= 75
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {cls.attendanceRate}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    style={{ width: `${cls.attendanceRate}%` }}
                    className="h-full bg-blue-600 rounded-full transition-all"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900">
                    <span className="text-[10px] text-slate-400 block">Hadir</span>
                    <span className="font-bold text-emerald-600">{cls.hadir}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900">
                    <span className="text-[10px] text-slate-400 block">Terlambat</span>
                    <span className="font-bold text-amber-500">{cls.terlambat}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900">
                    <span className="text-[10px] text-slate-400 block">Alpa</span>
                    <span className="font-bold text-rose-600">{cls.alpa}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Riwayat Catatan Tindak Lanjut */}
      {activeTab === 'notes' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Log Konseling & Pemanggilan Siswa
            </h3>
            <span className="text-xs text-slate-500">{followUpNotes.length} Catatan tersimpan</span>
          </div>

          <div className="space-y-3">
            {followUpNotes.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Belum ada catatan tindak lanjut yang disimpan.
              </div>
            ) : (
              followUpNotes.map(n => (
                <div
                  key={n.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold">
                        {n.category}
                      </span>
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {n.studentName}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">{n.date}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{n.notes}</p>
                  {n.actionPlan && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                      <strong>Rencana Tindakan:</strong> {n.actionPlan}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: New Follow-up Note */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Catatan Tindak Lanjut Guru BK / Kesiswaan
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Simpan laporan pemanggilan, bimbingan, atau kontak wali murid.
            </p>

            <form onSubmit={handleSaveNote} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Siswa
                </label>
                <select
                  value={selectedStudentForNote}
                  onChange={e => setSelectedStudentForNote(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nis} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori Permasalahan
                </label>
                <select
                  value={noteCategory}
                  onChange={e => setNoteCategory(e.target.value as any)}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="Absensi">Absensi / Sering Alpa</option>
                  <option value="Keterlambatan">Sering Terlambat</option>
                  <option value="Toilet">Frekuensi / Durasi Toilet Berlebihan</option>
                  <option value="Perilaku">Perilaku & Ketertiban</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Pembinaan / Wawancara
                </label>
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder="Hasil bimbingan atau klarifikasi bersama siswa..."
                  rows={3}
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rencana Tindak Lanjut (Action Plan)
                </label>
                <input
                  type="text"
                  value={actionPlan}
                  onChange={e => setActionPlan(e.target.value)}
                  placeholder="Contoh: Pemanggilan orang tua atau pembatasan izin keluar"
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNote}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow"
                >
                  {isSubmittingNote ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
