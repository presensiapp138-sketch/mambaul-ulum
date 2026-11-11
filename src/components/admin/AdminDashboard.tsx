import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Settings,
  Users,
  Camera,
  MapPin,
  GraduationCap,
  Upload,
  Download,
  Database,
  Shield,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  FileSpreadsheet,
  QrCode,
  Printer,
  RefreshCw,
  Search,
  KeyRound,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSync } from '../../context/SyncContext.tsx';
import {
  SchoolSettings,
  SchoolClass,
  Student,
  Teacher,
  SchoolLocation,
  AuditLog,
  FaceTemplate,
} from '../../types/index.ts';
import { apiRequest } from '../../lib/api.ts';
import {
  loadFaceDetectionModels,
  detectSingleFaceDescriptor,
} from '../../lib/faceDetection.ts';
import { CardSkeleton, TableSkeleton } from '../common/Skeleton.tsx';
import { ConfirmModal } from '../common/ConfirmModal.tsx';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { settings, updateSettings, triggerSync } = useSync();

  // Tabs
  const [activeTab, setActiveTab] = useState<
    'settings' | 'users' | 'face_db' | 'locations' | 'classes' | 'students' | 'bulk_upload' | 'id_cards' | 'audit_log'
  >('settings');

  // Data states
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [locations, setLocations] = useState<SchoolLocation[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [faceTemplates, setFaceTemplates] = useState<FaceTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Partial<SchoolSettings>>({});
  const [settingsSaved, setSettingsSaved] = useState<boolean>(false);

  // Delete modal confirmation
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Load all admin data
  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clsRes, stdRes, tchRes, locRes, usrRes, audRes, faceRes] = await Promise.all([
        apiRequest<SchoolClass[]>('/api/classes'),
        apiRequest<Student[]>('/api/students'),
        apiRequest<Teacher[]>('/api/teachers'),
        apiRequest<SchoolLocation[]>('/api/locations'),
        apiRequest<any[]>('/api/users'),
        apiRequest<AuditLog[]>('/api/audit-log'),
        apiRequest<FaceTemplate[]>('/api/face-templates'),
      ]);

      if (clsRes.success && clsRes.data) setClasses(clsRes.data);
      if (stdRes.success && stdRes.data) setStudents(stdRes.data);
      if (tchRes.success && tchRes.data) setTeachers(tchRes.data);
      if (locRes.success && locRes.data) setLocations(locRes.data);
      if (usrRes.success && usrRes.data) setUsersList(usrRes.data);
      if (audRes.success && audRes.data) setAuditLogs(audRes.data);
      if (faceRes.success && faceRes.data) setFaceTemplates(faceRes.data);
    } catch (e) {
      console.error('Error fetching admin data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (settings) {
      setSettingsForm(settings);
    }
  }, [settings]);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await updateSettings(settingsForm);
    if (ok) {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    }
  };

  // Trigger Google Sheets Init / Migration
  const handleInitSheets = async () => {
    try {
      const res = await apiRequest('/api/sheets/init', { method: 'POST' });
      alert(res.message || 'Inisialisasi tabel Google Sheets selesai!');
      loadAdminData();
      triggerSync();
    } catch (e: any) {
      alert(e.message || 'Gagal inisialisasi Google Sheets.');
    }
  };

  // Drive Backup
  const handleCreateBackup = async () => {
    try {
      const res = await apiRequest('/api/backup', { method: 'POST' });
      alert(res.message || `Backup berhasil dibuat: ${res.fileName}`);
    } catch (e: any) {
      alert(e.message || 'Gagal membuat backup.');
    }
  };

  // Download Student & Teacher Template (.xlsx)
  const handleDownloadTemplate = () => {
    // Student template sheet
    const studentSample = [
      {
        nis: '10202610',
        nisn: '0071234580',
        nama: 'Ahmad Zaki Fauzan',
        jenisKelamin: 'L',
        classId: classes[0]?.id || 'cls-10-rpl-1',
        barcodeCard: 'CARD-10202610',
        noHpOrtu: '081234567890',
      },
      {
        nis: '10202611',
        nisn: '0071234581',
        nama: 'Nabila Putri Cahyani',
        jenisKelamin: 'P',
        classId: classes[0]?.id || 'cls-10-rpl-1',
        barcodeCard: 'CARD-10202611',
        noHpOrtu: '081234567891',
      },
    ];

    const teacherSample = [
      {
        nip: '198705122011011004',
        name: 'Hendra Gunawan, M.Kom',
        email: 'hendra.gunawan@sekolah.sch.id',
        phone: '081234567892',
        subject: 'Pemrograman Web',
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsStudents = XLSX.utils.json_to_sheet(studentSample);
    const wsTeachers = XLSX.utils.json_to_sheet(teacherSample);

    XLSX.utils.book_append_sheet(wb, wsStudents, 'Template_Siswa');
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'Template_Guru');
    XLSX.writeFile(wb, 'Template_Import_Presensi_Sekolah.xlsx');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-md">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Panel Administrator Utama
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Konfigurasi Sekolah, Manajemen Pengguna, Biometric Wajah, dan Database Google Sheets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleInitSheets}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition"
            title="Inisialisasi tabel dan header Google Sheets"
          >
            <Database className="w-4 h-4" />
            <span>Init Google Sheets</span>
          </button>

          <button
            onClick={handleCreateBackup}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition"
          >
            <Download className="w-4 h-4" />
            <span>Backup ke Drive</span>
          </button>
        </div>
      </div>

      {/* Admin Navigation Pills */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'settings', label: 'Pengaturan Sekolah', icon: <Settings className="w-4 h-4" /> },
          { id: 'users', label: 'Pengguna & Akun', icon: <Users className="w-4 h-4" /> },
          { id: 'face_db', label: 'Database Wajah', icon: <Camera className="w-4 h-4" /> },
          { id: 'locations', label: 'Titik Lokasi GPS', icon: <MapPin className="w-4 h-4" /> },
          { id: 'classes', label: 'Kelas & Naik Kelas', icon: <GraduationCap className="w-4 h-4" /> },
          { id: 'students', label: 'Data Siswa', icon: <Users className="w-4 h-4" /> },
          { id: 'bulk_upload', label: 'Upload Massal', icon: <Upload className="w-4 h-4" /> },
          { id: 'id_cards', label: 'Cetak Kartu Siswa', icon: <QrCode className="w-4 h-4" /> },
          { id: 'audit_log', label: 'Audit Log', icon: <Shield className="w-4 h-4" /> },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === item.id
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Settings Form */}
      {activeTab === 'settings' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-w-4xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pengaturan Sistem Presensi</h3>
            <p className="text-xs text-slate-500">
              Konfigurasi jam masuk, toleransi terlambat, batas toilet, dan tahun ajaran
            </p>
          </div>

          {settingsSaved && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan sekolah berhasil diperbarui!</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Sekolah
                </label>
                <input
                  type="text"
                  value={settingsForm.schoolName || ''}
                  onChange={e => setSettingsForm({ ...settingsForm, schoolName: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tahun Ajaran
                </label>
                <input
                  type="text"
                  value={settingsForm.academicYear || ''}
                  onChange={e => setSettingsForm({ ...settingsForm, academicYear: e.target.value })}
                  placeholder="2026/2027"
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jam Mulai Presensi Masuk (WIB)
                </label>
                <input
                  type="time"
                  value={settingsForm.checkInTime || '07:00'}
                  onChange={e => setSettingsForm({ ...settingsForm, checkInTime: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Batas Akhir Hadir Tepat Waktu (Cutoff Terlambat)
                </label>
                <input
                  type="time"
                  value={settingsForm.lateCutoffTime || '07:15'}
                  onChange={e => setSettingsForm({ ...settingsForm, lateCutoffTime: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jam Pulang Sekolah
                </label>
                <input
                  type="time"
                  value={settingsForm.checkOutTime || '15:00'}
                  onChange={e => setSettingsForm({ ...settingsForm, checkOutTime: e.target.value })}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Batas Durasi Toilet (Menit)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settingsForm.toiletMaxMinutes || 10}
                  onChange={e => setSettingsForm({ ...settingsForm, toiletMaxMinutes: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ambang Peringatan BK: Sering Alpa (Kali)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settingsForm.warningThresholdAbsent || 3}
                  onChange={e => setSettingsForm({ ...settingsForm, warningThresholdAbsent: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ambang Peringatan BK: Sering Terlambat (Kali)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settingsForm.warningThresholdLate || 3}
                  onChange={e => setSettingsForm({ ...settingsForm, warningThresholdLate: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.teacherPhotoProofEnabled || false}
                  onChange={e => setSettingsForm({ ...settingsForm, teacherPhotoProofEnabled: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Simpan Foto Bukti Presensi Guru ke Google Drive (Default: Nonaktif)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.parentNotificationEnabled || false}
                  onChange={e => setSettingsForm({ ...settingsForm, parentNotificationEnabled: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Kirim Notifikasi Presensi ke Orang Tua / Wali
                </span>
              </label>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/25 transition"
              >
                Simpan Pengaturan Sekolah
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Users Management */}
      {activeTab === 'users' && (
        <UserManagementSection
          users={usersList}
          classes={classes}
          onRefresh={loadAdminData}
        />
      )}

      {/* Tab 3: Face Database Registration */}
      {activeTab === 'face_db' && (
        <FaceDatabaseSection
          students={students}
          teachers={teachers}
          faceTemplates={faceTemplates}
          onRefresh={loadAdminData}
        />
      )}

      {/* Tab 4: Locations Settings */}
      {activeTab === 'locations' && (
        <LocationsSection
          locations={locations}
          onRefresh={loadAdminData}
        />
      )}

      {/* Tab 5: Classes & Promotion (Naik Kelas) */}
      {activeTab === 'classes' && (
        <ClassesSection
          classes={classes}
          teachers={teachers}
          students={students}
          onRefresh={loadAdminData}
        />
      )}

      {/* Tab 6: Students CRUD */}
      {activeTab === 'students' && (
        <StudentsSection
          students={students}
          classes={classes}
          onRefresh={loadAdminData}
        />
      )}

      {/* Tab 7: Bulk Upload Students */}
      {activeTab === 'bulk_upload' && (
        <BulkUploadSection
          classes={classes}
          onDownloadTemplate={handleDownloadTemplate}
          onRefresh={loadAdminData}
        />
      )}

      {/* Tab 8: Bulk ID Cards / QR Print Preview */}
      {activeTab === 'id_cards' && (
        <IdCardsSection
          students={students}
          classes={classes}
          schoolName={settings?.schoolName || 'Yayasan Mambaul Ulum'}
        />
      )}

      {/* Tab 9: Audit Log */}
      {activeTab === 'audit_log' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Audit Trail Aktivitas Sistem</h3>
            <span className="text-xs text-slate-500">100 Log Terbaru</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-3">Waktu</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Aksi</th>
                  <th className="py-3 px-3">Entitas</th>
                  <th className="py-3 px-3">Rincian Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">{log.userId}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-mono text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{log.entity}</td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Sub-components for Admin
// -----------------------------------------------------------------------------

// Face Database Enrollment
const FaceDatabaseSection: React.FC<{
  students: Student[];
  teachers: Teacher[];
  faceTemplates: FaceTemplate[];
  onRefresh: () => void;
}> = ({ students, teachers, faceTemplates, onRefresh }) => {
  const [selectedPersonType, setSelectedPersonType] = useState<'student' | 'teacher'>('student');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const enrolledPersonIds = new Set(faceTemplates.map(f => f.personId));

  const startCamera = async () => {
    setCameraLoading(true);
    setMessage(null);
    try {
      await loadFaceDetectionModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (e: any) {
      alert('Gagal mengakses kamera: ' + (e.message || ''));
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Capture face descriptor and save vector to server
  const handleEnrollFace = async () => {
    if (!selectedPersonId || !videoRef.current) return;
    setIsCapturing(true);
    setMessage(null);

    try {
      const descriptor = await detectSingleFaceDescriptor(videoRef.current);
      if (!descriptor) {
        alert('Wajah tidak terdeteksi jelas. Posisikan wajah di tengah kamera.');
        setIsCapturing(false);
        return;
      }

      // Save 128 float descriptor vector
      const res = await apiRequest('/api/face-templates', {
        method: 'POST',
        body: JSON.stringify({
          personId: selectedPersonId,
          personType: selectedPersonType,
          descriptor,
        }),
      });

      if (res.success) {
        setMessage('Wajah berhasil didaftarkan! Hanya vektor descriptor 128 float yang disimpan.');
        stopCamera();
        onRefresh();
      } else {
        alert(res.error || 'Gagal menyimpan template wajah.');
      }
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Enrollment Card */}
      <div className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Pendaftaran Wajah Baru (Biometric)</h3>
          <p className="text-xs text-slate-500">
            Kamera memproses di browser dan hanya menyimpan 128 angka (vektor). Foto gambar tidak pernah disimpan.
          </p>
        </div>

        {message && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs">
            {message}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedPersonType('student');
                setSelectedPersonId('');
              }}
              className={`py-2 text-xs font-bold rounded-xl border ${
                selectedPersonType === 'student'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Wajah Siswa
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedPersonType('teacher');
                setSelectedPersonId('');
              }}
              className={`py-2 text-xs font-bold rounded-xl border ${
                selectedPersonType === 'teacher'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Wajah Guru
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pilih {selectedPersonType === 'student' ? 'Siswa' : 'Guru'}
            </label>
            <select
              value={selectedPersonId}
              onChange={e => setSelectedPersonId(e.target.value)}
              className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              <option value="">-- Pilih Nama --</option>
              {selectedPersonType === 'student'
                ? students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nis} - {s.name} {enrolledPersonIds.has(s.id) ? '✓ (Terdaftar)' : '✗ (Belum)'}
                    </option>
                  ))
                : teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {enrolledPersonIds.has(t.id) ? '✓ (Terdaftar)' : '✗ (Belum)'}
                    </option>
                  ))}
            </select>
          </div>

          {/* Camera preview */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 min-h-[260px] flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full max-w-sm rounded-xl ${isCameraActive ? 'block' : 'hidden'}`}
            />
            {!isCameraActive && (
              <div className="text-center p-6 space-y-2">
                <Camera className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400">Tekan tombol di bawah untuk menyalakan kamera</p>
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={!selectedPersonId || cameraLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
                >
                  {cameraLoading ? 'Memulai...' : 'Nyalakan Kamera Pendaftaran'}
                </button>
              </div>
            )}
          </div>

          {isCameraActive && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleEnrollFace}
                disabled={isCapturing}
                className="flex-1 py-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow transition"
              >
                {isCapturing ? 'Mengekstrak Vektor...' : 'Ambil Foto & Simpan Vektor'}
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-3 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right List: Status Terdaftar / Belum */}
      <div className="lg:col-span-6 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Status Pendaftaran Biometric ({faceTemplates.length} Wajah Terdaftar)
        </h3>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {students.map(s => {
            const isEnrolled = enrolledPersonIds.has(s.id);
            const template = faceTemplates.find(f => f.personId === s.id);
            return (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{s.name}</div>
                  <div className="text-[11px] text-slate-400">NIS: {s.nis} • Siswa</div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                      isEnrolled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {isEnrolled ? 'Terdaftar' : 'Belum'}
                  </span>

                  {template && (
                    <button
                      onClick={async () => {
                        if (confirm(`Hapus data wajah ${s.name}?`)) {
                          await apiRequest(`/api/face-templates/${template.id}`, { method: 'DELETE' });
                          onRefresh();
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 transition"
                      title="Hapus template wajah"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Users Management Section
const UserManagementSection: React.FC<{
  users: any[];
  classes: SchoolClass[];
  onRefresh: () => void;
}> = ({ users, classes, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'wali_kelas' | 'bk' | 'kesiswaan' | 'guru'>('guru');
  const [classId, setClassId] = useState('');
  const [email, setEmail] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, name, role, classId, email }),
      });
      if (res.success) {
        setShowModal(false);
        setUsername('');
        setPassword('');
        setName('');
        onRefresh();
      } else {
        alert(res.error || 'Gagal membuat pengguna');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Manajemen Akun Guru & Staf</h3>
          <p className="text-xs text-slate-500">Atur hak akses login, reset kata sandi, dan status aktif</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
              <th className="py-3 px-3">Nama Lengkap</th>
              <th className="py-3 px-3">Username</th>
              <th className="py-3 px-3">Peran (Role)</th>
              <th className="py-3 px-3">Kelas Binaan</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{u.name}</td>
                <td className="py-3 px-3 font-mono text-slate-500">{u.username}</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {u.role}
                  </span>
                </td>
                <td className="py-3 px-3 text-slate-500">
                  {classes.find(c => c.id === u.classId)?.name || '-'}
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.isActive ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950' : 'text-slate-400 bg-slate-100'
                    }`}
                  >
                    {u.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={async () => {
                      const newP = prompt('Masukkan password baru:');
                      if (newP) {
                        await apiRequest(`/api/users/${u.id}/password`, {
                          method: 'PUT',
                          body: JSON.stringify({ newPassword: newP }),
                        });
                        alert('Password berhasil direset!');
                      }
                    }}
                    className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition"
                  >
                    Reset Sandi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Tambah Pengguna Baru</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Peran (Role)</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="guru">Guru Mapel</option>
                  <option value="wali_kelas">Wali Kelas</option>
                  <option value="bk">Guru BK</option>
                  <option value="kesiswaan">Staf Kesiswaan</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              {role === 'wali_kelas' && (
                <div>
                  <label className="block font-semibold mb-1">Kelas yang Diampu</label>
                  <select
                    value={classId}
                    onChange={e => setClassId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Locations Section
const LocationsSection: React.FC<{
  locations: SchoolLocation[];
  onRefresh: () => void;
}> = ({ locations, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('150');

  const handleGetCurrentGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLatitude(String(pos.coords.latitude));
          setLongitude(String(pos.coords.longitude));
        },
        err => alert('Gagal mendeteksi GPS: ' + err.message)
      );
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/locations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          latitude: Number(latitude),
          longitude: Number(longitude),
          radiusMeters: Number(radiusMeters),
        }),
      });
      if (res.success) {
        setShowModal(false);
        setName('');
        setLatitude('');
        setLongitude('');
        onRefresh();
      } else {
        alert(res.error || 'Gagal menyimpan lokasi');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Titik Geofence Presensi Guru</h3>
          <p className="text-xs text-slate-500">Presensi guru hanya diterima jika berada dalam radius titik ini</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Lokasi</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map(loc => (
          <div
            key={loc.id}
            className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900 dark:text-white">{loc.name}</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                Radius {loc.radiusMeters}m
              </span>
            </div>
            <div className="font-mono text-slate-500 text-[11px]">
              Lat: {loc.latitude}, Lng: {loc.longitude}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={async () => {
                  if (confirm(`Hapus titik lokasi ${loc.name}?`)) {
                    await apiRequest(`/api/locations/${loc.id}`, { method: 'DELETE' });
                    onRefresh();
                  }
                }}
                className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Tambah Titik Lokasi Baru</h3>
            <form onSubmit={handleCreateLocation} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nama Titik Lokasi</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Contoh: Kampus Utama / Gedung Lab"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={handleGetCurrentGps}
                  className="px-3 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-xl font-semibold flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Ambil GPS Perangkat Ini</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={e => setLatitude(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={e => setLongitude(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Radius Toleransi (Meter)</label>
                <input
                  type="number"
                  value={radiusMeters}
                  onChange={e => setRadiusMeters(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Simpan Lokasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Classes & Promotion Section
const ClassesSection: React.FC<{
  classes: SchoolClass[];
  teachers: Teacher[];
  students: Student[];
  onRefresh: () => void;
}> = ({ classes, teachers, students, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('10');
  const [homeRoomTeacherId, setHomeRoomTeacherId] = useState('');

  // Promote states
  const [sourceClassId, setSourceClassId] = useState(classes[0]?.id || '');
  const [targetClassId, setTargetClassId] = useState('');
  const [action, setAction] = useState<'promote' | 'graduate'>('promote');

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/classes', {
        method: 'POST',
        body: JSON.stringify({ name: className, grade, homeRoomTeacherId }),
      });
      if (res.success) {
        setShowModal(false);
        setClassName('');
        onRefresh();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/classes/promote', {
        method: 'POST',
        body: JSON.stringify({ sourceClassId, targetClassId, action }),
      });
      if (res.success) {
        alert(res.message);
        setShowPromoteModal(false);
        onRefresh();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Manajemen Kelas & Promosi</h3>
          <p className="text-xs text-slate-500">Kelola kelas, penetapan wali kelas, dan kenaikan kelas massal</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPromoteModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 transition"
          >
            Naik Kelas Massal
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kelas</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {classes.map(c => (
          <div
            key={c.id}
            className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-slate-900 dark:text-white">{c.name}</span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-[10px]">
                Tingkat {c.grade}
              </span>
            </div>
            <div className="text-slate-500 text-[11px]">
              Wali: {c.homeRoomTeacherName || 'Belum ada'}
            </div>
            <div className="text-slate-500 text-[11px]">
              Jumlah: {students.filter(s => s.classId === c.id && s.isActive).length} Siswa
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Tambah Kelas Baru</h3>
            <form onSubmit={handleCreateClass} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nama Kelas</label>
                <input
                  type="text"
                  value={className}
                  onChange={e => setClassName(e.target.value)}
                  placeholder="Contoh: X RPL 3"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Tingkat</label>
                <select
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="10">Kelas 10 (Fase E)</option>
                  <option value="11">Kelas 11 (Fase F)</option>
                  <option value="12">Kelas 12 (Fase F Lanjut)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Wali Kelas</label>
                <select
                  value={homeRoomTeacherId}
                  onChange={e => setHomeRoomTeacherId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="">-- Belum Ditentukan --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPromoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Kenaikan Kelas Massal</h3>
            <p className="text-xs text-slate-500 mb-4">
              Pindahkan seluruh siswa dari satu kelas ke kelas tingkat selanjutnya atau luluskan.
            </p>

            <form onSubmit={handlePromote} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Kelas Asal</label>
                <select
                  value={sourceClassId}
                  onChange={e => setSourceClassId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({students.filter(s => s.classId === c.id && s.isActive).length} Siswa)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Aksi</label>
                <select
                  value={action}
                  onChange={e => setAction(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="promote">Naik ke Kelas Baru</option>
                  <option value="graduate">Lulus / Alumni (Nonaktifkan)</option>
                </select>
              </div>

              {action === 'promote' && (
                <div>
                  <label className="block font-semibold mb-1">Kelas Tujuan</label>
                  <select
                    value={targetClassId}
                    onChange={e => setTargetClassId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    required
                  >
                    <option value="">-- Pilih Kelas Tujuan --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPromoteModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold"
                >
                  Proses Kenaikan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Students Section
const StudentsSection: React.FC<{
  students: Student[];
  classes: SchoolClass[];
  onRefresh: () => void;
}> = ({ students, classes, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [nis, setNis] = useState('');
  const [nisn, setNisn] = useState('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [barcodeCard, setBarcodeCard] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/students', {
        method: 'POST',
        body: JSON.stringify({
          name,
          nis,
          nisn,
          gender,
          classId,
          barcodeCard: barcodeCard || `CARD-${nis}`,
          parentPhone,
        }),
      });
      if (res.success) {
        setShowModal(false);
        setName('');
        setNis('');
        onRefresh();
      } else {
        alert(res.error || 'Gagal menambah siswa');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = students.filter(
    s => s.name.toLowerCase().includes(search.toLowerCase()) || s.nis.includes(search)
  );

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Database Siswa ({students.length})</h3>
          <p className="text-xs text-slate-500">Kelola data induk siswa, barcode kartu, dan nomor kontak orang tua</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari siswa atau NIS..."
            className="px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          />
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
              <th className="py-3 px-3">NIS</th>
              <th className="py-3 px-3">Nama Siswa</th>
              <th className="py-3 px-3">Kelas</th>
              <th className="py-3 px-3">Kode Barcode/RFID</th>
              <th className="py-3 px-3">Wajah</th>
              <th className="py-3 px-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-3 font-mono">{s.nis}</td>
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{s.name}</td>
                <td className="py-3 px-3 text-slate-500">{classes.find(c => c.id === s.classId)?.name || '-'}</td>
                <td className="py-3 px-3 font-mono text-[11px] text-blue-600">{s.barcodeCard}</td>
                <td className="py-3 px-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      s.hasFaceEnrolled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                    }`}
                  >
                    {s.hasFaceEnrolled ? 'Terdaftar' : 'Belum'}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={async () => {
                      if (confirm(`Hapus siswa ${s.name}?`)) {
                        await apiRequest(`/api/students/${s.id}`, { method: 'DELETE' });
                        onRefresh();
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Tambah Siswa Baru</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">NIS</label>
                  <input
                    type="text"
                    value={nis}
                    onChange={e => setNis(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">NISN</label>
                  <input
                    type="text"
                    value={nisn}
                    onChange={e => setNisn(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Jenis Kelamin</label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Kelas</label>
                  <select
                    value={classId}
                    onChange={e => setClassId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Kode Kartu Barcode/RFID (Opsional)</label>
                <input
                  type="text"
                  value={barcodeCard}
                  onChange={e => setBarcodeCard(e.target.value)}
                  placeholder="Kosongkan jika otomatis = CARD-[NIS]"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">No. HP Orang Tua / Wali</label>
                <input
                  type="text"
                  value={parentPhone}
                  onChange={e => setParentPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Bulk Upload Section (Excel/CSV Parser & Preview)
const BulkUploadSection: React.FC<{
  classes: SchoolClass[];
  onDownloadTemplate: () => void;
  onRefresh: () => void;
}> = ({ classes, onDownloadTemplate, onRefresh }) => {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [errorReport, setErrorReport] = useState<any[]>([]);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setParsedRows(data);
      setErrorReport([]);
      setUploadResult(null);
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    try {
      const res = await apiRequest<{
        importedCount: number;
        errorCount: number;
        errorRows: any[];
        message: string;
      }>('/api/students/bulk', {
        method: 'POST',
        body: JSON.stringify({
          rows: parsedRows,
          classId: selectedClassId,
        }),
      });

      if (res.success) {
        setUploadResult(res.message || null);
        setErrorReport(res.errorRows || []);
        onRefresh();
      } else {
        alert(res.error || 'Import gagal.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Upload Massal Data Siswa (Excel/CSV)</h3>
          <p className="text-xs text-slate-500">
            Validasi format, deteksi duplikasi NIS/NISN, dan pratinjau tabel sebelum disimpan
          </p>
        </div>

        <button
          onClick={onDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition"
        >
          <Download className="w-4 h-4" />
          <span>Unduh Template Excel (.xlsx)</span>
        </button>
      </div>

      <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/20">
        <Upload className="w-8 h-8 text-blue-500 mx-auto" />
        <div>
          <label className="cursor-pointer font-bold text-xs text-blue-600 hover:text-blue-700">
            <span>Pilih File Excel / CSV</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <p className="text-[11px] text-slate-400 mt-1">Mendukung format .xlsx, .xls, .csv</p>
        </div>
      </div>

      {uploadResult && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <span>{uploadResult}</span>
        </div>
      )}

      {errorReport.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-200 space-y-1.5 border border-red-200">
          <div className="font-bold">Daftar Baris Error:</div>
          <ul className="list-disc pl-5 space-y-1">
            {errorReport.map((err, i) => (
              <li key={i}>
                Baris #{err.rowNumber}: {err.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {parsedRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Pratinjau Data ({parsedRows.length} Baris Terdeteksi)
            </span>

            <button
              onClick={handleExecuteImport}
              disabled={isProcessing}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow disabled:opacity-50 transition"
            >
              {isProcessing ? 'Memproses Import...' : 'Simpan Semua ke Database'}
            </button>
          </div>

          <div className="overflow-x-auto max-h-60 border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                <tr>
                  <th className="p-2.5">NIS</th>
                  <th className="p-2.5">Nama</th>
                  <th className="p-2.5">L/P</th>
                  <th className="p-2.5">No HP Ortu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parsedRows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td className="p-2.5 font-mono">{r.nis}</td>
                    <td className="p-2.5 font-bold">{r.nama || r.name}</td>
                    <td className="p-2.5">{r.gender || r.jenisKelamin || 'L'}</td>
                    <td className="p-2.5">{r.parentPhone || r.noHpOrtu || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Bulk ID Cards & QR Print Section
const IdCardsSection: React.FC<{
  students: Student[];
  classes: SchoolClass[];
  schoolName: string;
}> = ({ students, classes, schoolName }) => {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const filtered = students.filter(s => s.classId === selectedClassId && s.isActive);

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Cetak Kartu Siswa & Barcode Massal</h3>
          <p className="text-xs text-slate-500">Format kartu presensi siap cetak untuk dompet atau lanyard siswa</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            className="px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                Kelas {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow transition"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Halaman Ini</span>
          </button>
        </div>
      </div>

      {/* Grid ID Cards Printable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2">
        {filtered.map(std => {
          const cls = classes.find(c => c.id === std.classId);
          return (
            <div
              key={std.id}
              className="p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 shadow-sm space-y-4 print:border-black print:break-inside-avoid"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">
                    KARTU PRESENSI DIGITAL
                  </div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">{schoolName}</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  ID
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-14 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold">
                  {std.gender === 'L' ? 'L' : 'P'}
                </div>
                <div className="space-y-0.5">
                  <div className="font-black text-sm text-slate-900 dark:text-white">{std.name}</div>
                  <div className="text-xs font-mono text-slate-500">NIS: {std.nis}</div>
                  <div className="text-[11px] font-semibold text-blue-600">Kelas: {cls?.name}</div>
                </div>
              </div>

              {/* Barcode Mock Graphic & Scannable Code */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-center space-y-1">
                <div className="font-mono text-xs font-black tracking-widest text-slate-800 dark:text-slate-200">
                  {std.barcodeCard}
                </div>
                {/* SVG Barcode lines */}
                <div className="h-9 flex items-center justify-center gap-0.5 overflow-hidden">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-black dark:bg-white h-full"
                      style={{ width: i % 3 === 0 ? '3px' : i % 2 === 0 ? '1.5px' : '2px' }}
                    />
                  ))}
                </div>
                <span className="text-[9px] text-slate-400 block">Dapat discan lewat kamera atau scanner fisik</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
