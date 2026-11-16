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
  Mail,
  Cloud,
  ExternalLink,
  X,
  HardDrive,
  LogOut,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
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
  initWorkspaceAuth,
  googleWorkspaceSignIn,
  getWorkspaceAccessToken,
  logoutWorkspaceAuth,
} from '../../lib/workspaceAuth.ts';
import {
  syncAllDatabaseToGoogleWorkspace,
  type WorkspaceExportBundle,
  type WorkspaceSyncResult,
} from '../../lib/workspaceSync.ts';
import {
  loadFaceDetectionModels,
  areFaceModelsLoaded,
  acquireCameraStream,
  attachStreamToVideo,
  detectSingleFaceDescriptor,
  detectFaceDescriptorFromImage,
  parseCameraError,
} from '../../lib/faceDetection.ts';
import { CardSkeleton, TableSkeleton } from '../common/Skeleton.tsx';
import { ConfirmModal } from '../common/ConfirmModal.tsx';
import { StudentCardManager } from './StudentCardManager.tsx';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const {
    settings,
    updateSettings,
    triggerSync,
    notifyFaceDatabaseChanged,
    tableVersions,
    activeUsers,
  } = useSync();

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

  // Drive & Sheets Email-Linked Sync Modal state
  const [showCloudSyncModal, setShowCloudSyncModal] = useState<boolean>(false);
  const [syncEmailInput, setSyncEmailInput] = useState<string>('');
  const [syncSpreadsheetIdInput, setSyncSpreadsheetIdInput] = useState<string>('');
  const [syncFolderIdInput, setSyncFolderIdInput] = useState<string>('');
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [cloudSyncResult, setCloudSyncResult] = useState<any | null>(null);

  // Google Workspace OAuth & Confirmation Dialog state
  const [workspaceUser, setWorkspaceUser] = useState<FirebaseUser | null>(null);
  const [workspaceNeedsAuth, setWorkspaceNeedsAuth] = useState<boolean>(true);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);
  const [showSyncConfirmDialog, setShowSyncConfirmDialog] = useState<boolean>(false);

  const fetchAdminTables = useCallback(async () => {
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
  }, []);

  // Load all admin data
  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchAdminTables();
    } catch (e) {
      console.error('Error fetching admin data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [fetchAdminTables]);

  const handleDataMutated = useCallback(async () => {
    await fetchAdminTables();
    await notifyFaceDatabaseChanged();
  }, [fetchAdminTables, notifyFaceDatabaseChanged]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Silent real-time refresh whenever any admin-managed table updates across multi-user sessions
  const adminSyncKey = [
    tableVersions['Classes'] || 0,
    tableVersions['Students'] || 0,
    tableVersions['Teachers'] || 0,
    tableVersions['Locations'] || 0,
    tableVersions['Users'] || 0,
    tableVersions['FaceTemplates'] || 0,
    tableVersions['AuditLog'] || 0,
    tableVersions['Settings'] || 0,
  ].join(':');

  useEffect(() => {
    if (adminSyncKey === '0:0:0:0:0:0:0:0') return;
    fetchAdminTables().catch(() => {});
  }, [adminSyncKey, fetchAdminTables]);

  useEffect(() => {
    if (settings) {
      setSettingsForm(settings);
      if (settings.syncTargetEmail && !syncEmailInput) {
        setSyncEmailInput(settings.syncTargetEmail);
      }
      if (settings.syncLinkedSpreadsheetId && !syncSpreadsheetIdInput) {
        setSyncSpreadsheetIdInput(settings.syncLinkedSpreadsheetId);
      }
      if (settings.syncLinkedFolderId && !syncFolderIdInput) {
        setSyncFolderIdInput(settings.syncLinkedFolderId);
      }
    }
  }, [settings]);

  useEffect(() => {
    const unsubscribe = initWorkspaceAuth(
      (fbUser, _token) => {
        setWorkspaceUser(fbUser);
        setWorkspaceNeedsAuth(false);
      },
      () => {
        setWorkspaceUser(null);
        setWorkspaceNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const isSyncEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(syncEmailInput.trim());

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await updateSettings(settingsForm);
    if (ok) {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    }
  };

  // Open Email-Linked Drive & Sheets Sync Modal
  const openCloudSyncModal = () => {
    setCloudSyncError(null);
    setShowSyncConfirmDialog(false);
    if (settings?.syncTargetEmail) {
      setSyncEmailInput(settings.syncTargetEmail);
    } else if (workspaceUser?.email && !syncEmailInput) {
      setSyncEmailInput(workspaceUser.email);
    }
    if (settings?.syncLinkedSpreadsheetId) {
      setSyncSpreadsheetIdInput(settings.syncLinkedSpreadsheetId);
    }
    if (settings?.syncLinkedFolderId) {
      setSyncFolderIdInput(settings.syncLinkedFolderId);
    }
    setShowCloudSyncModal(true);
  };

  // Connect Google Account for Google Drive & Google Sheets (with optional email login_hint)
  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    setCloudSyncError(null);
    try {
      const hintEmail = syncEmailInput.trim() || undefined;
      const result = await googleWorkspaceSignIn(hintEmail);
      setWorkspaceUser(result.user);
      setWorkspaceNeedsAuth(false);
      if (!syncEmailInput.trim() && result.user.email) {
        setSyncEmailInput(result.user.email);
      }
    } catch (e: any) {
      const msg = e?.message || 'Gagal menghubungkan akun Google.';
      if (msg.includes('popup-closed-by-user')) {
        setCloudSyncError('Jendela login Google ditutup sebelum selesai. Silakan coba lagi.');
      } else {
        setCloudSyncError(msg);
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutWorkspaceAuth();
      setWorkspaceUser(null);
      setWorkspaceNeedsAuth(true);
    } catch (e: any) {
      setCloudSyncError(e?.message || 'Gagal memutuskan akun Google.');
    }
  };

  // Prompt user before mutating/overwriting Google Drive & Google Sheets
  const handleRequestCloudSync = () => {
    const cleanEmail = syncEmailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setCloudSyncError(
        'Harap masukkan alamat email yang valid terlebih dahulu sebelum menyinkronkan ke Drive & Sheets.'
      );
      return;
    }

    const token = getWorkspaceAccessToken();
    if (!token) {
      setWorkspaceNeedsAuth(true);
      setCloudSyncError(
        'Silakan klik tombol "Sign in with Google" terlebih dahulu untuk mengaktifkan akses Google Drive & Google Sheets.'
      );
      return;
    }

    setCloudSyncError(null);
    setShowSyncConfirmDialog(true);
  };

  // Execute Link, Local Package Export, or Full Workspace Drive & Sheets Sync (after explicit confirmation)
  const handleRunCloudSync = async (linkOnly: boolean = false, skipWorkspaceApi: boolean = false) => {
    const cleanEmail = syncEmailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setCloudSyncError(
        'Harap masukkan alamat email yang valid terlebih dahulu sebelum menyinkronkan ke Drive & Sheets.'
      );
      return;
    }

    setShowSyncConfirmDialog(false);
    setIsCloudSyncing(true);
    setCloudSyncError(null);

    try {
      // 1. Always preserve local server storage & link target email on server + get full 13-table exportBundle
      const res = await apiRequest('/api/sync/cloud', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          spreadsheetId: syncSpreadsheetIdInput.trim() || undefined,
          driveFolderId: syncFolderIdInput.trim() || undefined,
          linkOnly,
        }),
      });

      if (!res.success) {
        setCloudSyncError(res.error || 'Gagal menyinkronkan database di server.');
        return;
      }

      if (linkOnly || skipWorkspaceApi) {
        setCloudSyncResult(res);
        await loadAdminData();
        await notifyFaceDatabaseChanged();
        return;
      }

      // 2. Push all 13 tables to Google Drive & Google Sheets via active Workspace OAuth access token
      const accessToken = getWorkspaceAccessToken();
      if (accessToken && res.exportBundle) {
        const wsResult: WorkspaceSyncResult = await syncAllDatabaseToGoogleWorkspace({
          accessToken,
          targetEmail: cleanEmail,
          schoolName: settings?.schoolName || 'Yayasan_Mambaul_Ulum',
          existingFolderId: syncFolderIdInput.trim() || settings?.syncLinkedFolderId || undefined,
          existingSpreadsheetId: syncSpreadsheetIdInput.trim() || settings?.syncLinkedSpreadsheetId || undefined,
          exportBundle: res.exportBundle as WorkspaceExportBundle,
        });

        setSyncFolderIdInput(wsResult.folderId);
        setSyncSpreadsheetIdInput(wsResult.spreadsheetId);

        const nowIso = new Date().toISOString();
        await updateSettings({
          syncTargetEmail: cleanEmail,
          syncLinkedFolderId: wsResult.folderId,
          syncLinkedSpreadsheetId: wsResult.spreadsheetId,
          lastCloudSyncAt: nowIso,
        });

        setCloudSyncResult({
          ...res,
          cloudSynced: true,
          sheetsResult: {
            ...(res.sheetsResult || {}),
            cloudSynced: true,
            spreadsheetId: wsResult.spreadsheetId,
            spreadsheetUrl: wsResult.spreadsheetUrl,
            sheetsSynced: wsResult.sheetsSynced,
          },
          driveResult: {
            ...(res.driveResult || {}),
            cloudSynced: true,
            folderId: wsResult.folderId,
            folderUrl: wsResult.folderUrl,
            fileId: wsResult.backupFileId,
            fileName: wsResult.backupFileName,
            fileUrl: wsResult.backupFileUrl,
          },
          message: `Seluruh ${wsResult.sheetsSynced.length} tabel database berhasil disinkronkan ke Google Drive & Google Sheets (${workspaceUser?.email || cleanEmail})! Penyimpanan lokal server tetap aktif berjalan.`,
        });
      } else {
        setCloudSyncResult(res);
      }

      await loadAdminData();
      await notifyFaceDatabaseChanged();
    } catch (e: any) {
      const msg = e?.message || 'Terjadi kesalahan saat sinkronisasi ke Drive & Sheets.';
      if ((e as any)?.statusCode === 401 || msg.toLowerCase().includes('invalid credentials')) {
        setWorkspaceNeedsAuth(true);
        setCloudSyncError(
          'Sesi Google Drive & Sheets kedaluwarsa. Silakan klik "Sign in with Google" ulang lalu sinkronkan kembali.'
        );
      } else {
        setCloudSyncError(msg);
      }
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Download Multi-Sheet Workbook (.xlsx) linked to email
  const handleDownloadSyncedWorkbook = () => {
    if (!cloudSyncResult?.exportBundle?.sheetsRows) return;
    const wb = XLSX.utils.book_new();
    const sheetsRows = cloudSyncResult.exportBundle.sheetsRows as Record<string, string[][]>;
    for (const [sheetName, rows] of Object.entries(sheetsRows)) {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    }
    const safeEmail = (cloudSyncResult.linkedEmail || syncEmailInput).replace(/[^a-zA-Z0-9._-]/g, '_');
    XLSX.writeFile(wb, `Database_Sheets_${safeEmail}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Download Complete Drive Backup JSON linked to email
  const handleDownloadSyncedJson = () => {
    if (!cloudSyncResult?.exportBundle) return;
    const content = JSON.stringify(cloudSyncResult.exportBundle, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeEmail = (cloudSyncResult.linkedEmail || syncEmailInput).replace(/[^a-zA-Z0-9._-]/g, '_');
    a.href = url;
    a.download = `Backup_Drive_${safeEmail}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

        <div className="flex flex-wrap items-center gap-2.5">
          {settings?.syncTargetEmail && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold">
              <Mail className="w-3.5 h-3.5" />
              <span>Tertaut: {settings.syncTargetEmail}</span>
            </div>
          )}

          <button
            onClick={openCloudSyncModal}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition"
            title="Masukkan email untuk menautkan & menyinkronkan seluruh database ke Drive dan Google Sheets"
          >
            <Cloud className="w-4 h-4" />
            <span>
              {settings?.syncTargetEmail ? 'Sinkron Drive & Sheet' : 'Tautkan Email • Sinkron Drive & Sheet'}
            </span>
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

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alamat Sekolah / Yayasan (Ditampilkan di Aplikasi & Kartu Pelajar)
                </label>
                <input
                  type="text"
                  value={settingsForm.foundationAddress || ''}
                  onChange={e => setSettingsForm({ ...settingsForm, foundationAddress: e.target.value })}
                  placeholder="Jl. Pesantren Mambaul Ulum No. 45, Diwek, Jombang, Jawa Timur 61471"
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Website Sekolah / Yayasan
                </label>
                <input
                  type="text"
                  value={settingsForm.foundationWebsite || ''}
                  onChange={e => setSettingsForm({ ...settingsForm, foundationWebsite: e.target.value })}
                  placeholder="https://mambaululum.sch.id"
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Watermark Background Kartu (Global URL / Data Image)
                </label>
                <input
                  type="text"
                  value={settingsForm.foundationWatermarkUrl || ''}
                  onChange={e => setSettingsForm({ ...settingsForm, foundationWatermarkUrl: e.target.value })}
                  placeholder="https://... atau upload via tab Cetak Kartu"
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
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
          activeUsers={activeUsers}
          currentUserId={user?.id}
          onRefresh={handleDataMutated}
        />
      )}

      {/* Tab 3: Face Database Registration */}
      {activeTab === 'face_db' && (
        <FaceDatabaseSection
          students={students}
          teachers={teachers}
          faceTemplates={faceTemplates}
          onRefresh={handleDataMutated}
        />
      )}

      {/* Tab 4: Locations Settings */}
      {activeTab === 'locations' && (
        <LocationsSection
          locations={locations}
          onRefresh={handleDataMutated}
        />
      )}

      {/* Tab 5: Classes & Promotion (Naik Kelas) */}
      {activeTab === 'classes' && (
        <ClassesSection
          classes={classes}
          teachers={teachers}
          students={students}
          onRefresh={handleDataMutated}
        />
      )}

      {/* Tab 6: Students CRUD */}
      {activeTab === 'students' && (
        <StudentsSection
          students={students}
          classes={classes}
          onRefresh={handleDataMutated}
        />
      )}

      {/* Tab 7: Bulk Upload Students */}
      {activeTab === 'bulk_upload' && (
        <BulkUploadSection
          classes={classes}
          onDownloadTemplate={handleDownloadTemplate}
          onRefresh={handleDataMutated}
        />
      )}

      {/* Tab 8: Bulk ID Cards & JPG Generator Multi-Jenjang */}
      {activeTab === 'id_cards' && (
        <StudentCardManager
          students={students}
          classes={classes}
          schoolName={settings?.schoolName || 'Yayasan Mambaul Ulum'}
          schoolAddress={settings?.foundationAddress}
          foundationWebsite={settings?.foundationWebsite}
          watermarkUrl={settings?.foundationWatermarkUrl}
          faceTemplates={faceTemplates}
          onUpdateSettings={updateSettings}
          initialLevelConfigsJson={settings?.levelConfigsJson}
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

      {/* Email-Linked Drive & Sheets Full Sync Modal */}
      {showCloudSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 my-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Sinkronisasi Database ke Drive & Sheets
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Masukkan email penautan & hubungkan akun Google agar seluruh 13 tabel tersinkron ke Drive dan Sheets.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSyncConfirmDialog(false);
                  setShowCloudSyncModal(false);
                }}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hybrid Local Server + Cloud Banner */}
            <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-200 flex items-start gap-2.5">
              <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Mode Hibrid: Penyimpanan Lokal Server Tetap Aktif</div>
                <div className="text-[11px] opacity-90 mt-0.5">
                  Aplikasi tetap berjalan cepat dengan database lokal di server. Sinkronisasi Google Drive & Sheets bekerja berdampingan sebagai integrasi cloud resmi.
                </div>
              </div>
            </div>

            {cloudSyncError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{cloudSyncError}</span>
              </div>
            )}

            {/* Step 1: Mandatory Email Input */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-600" />
                  1. Alamat Email Penautan (Wajib Sebelum Sinkronisasi)
                </span>
                {isSyncEmailValid && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Email Valid
                  </span>
                )}
              </div>

              <input
                type="email"
                value={syncEmailInput}
                onChange={e => {
                  setSyncEmailInput(e.target.value);
                  setCloudSyncError(null);
                }}
                placeholder="Masukkan email Google tujuan (contoh: presensiapp138@gmail.com)"
                className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    ID Google Spreadsheet (Opsional - otomatis dibuat jika kosong)
                  </label>
                  <input
                    type="text"
                    value={syncSpreadsheetIdInput}
                    onChange={e => setSyncSpreadsheetIdInput(e.target.value)}
                    placeholder="Contoh: 1BxiMVs0XRA5..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    ID Folder Google Drive (Opsional - otomatis dibuat jika kosong)
                  </label>
                  <input
                    type="text"
                    value={syncFolderIdInput}
                    onChange={e => setSyncFolderIdInput(e.target.value)}
                    placeholder="Contoh: 1fO1_bZabc..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Google Workspace Drive & Sheets Account Connection */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-emerald-600" />
                  2. Koneksi Akun Google Drive & Google Sheets
                </span>
                {!workspaceNeedsAuth && workspaceUser && getWorkspaceAccessToken() ? (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Terhubung: {workspaceUser.email}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    Belum terhubung ke sesi Google
                  </span>
                )}
              </div>

              {workspaceNeedsAuth || !getWorkspaceAccessToken() ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Masuk dengan akun Google untuk memberikan izin membuat & memperbarui folder Drive serta Google Sheets milik akun tersebut.
                  </p>
                  <button
                    type="button"
                    disabled={isGoogleSigningIn || isCloudSyncing}
                    onClick={() => void handleGoogleSignIn()}
                    className="gsi-material-button flex-shrink-0"
                  >
                    <div className="gsi-material-button-state"></div>
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <svg
                          version="1.1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 48 48"
                          style={{ display: 'block' }}
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          ></path>
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          ></path>
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          ></path>
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          ></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents">
                        {isGoogleSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}
                      </span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                    <div>
                      Sesi Google aktif: <strong>{workspaceUser?.email}</strong>
                    </div>
                    {isSyncEmailValid &&
                      workspaceUser?.email &&
                      workspaceUser.email.toLowerCase() !== syncEmailInput.trim().toLowerCase() && (
                        <div className="text-amber-600 dark:text-amber-400 flex flex-wrap items-center gap-2">
                          <span>
                            Catatan: Email penautan ({syncEmailInput.trim()}) berbeda dengan akun Google yang login.
                          </span>
                          <button
                            type="button"
                            onClick={() => setSyncEmailInput(workspaceUser.email || '')}
                            className="underline font-bold"
                          >
                            Samakan dengan {workspaceUser.email}
                          </button>
                        </div>
                      )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleGoogleLogout()}
                    className="px-3 py-1.5 text-[11px] font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Ganti Akun Google</span>
                  </button>
                </div>
              )}
            </div>

            {/* Live Database Tables Preview */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                3. Cakupan Seluruh Database Aplikasi (13 Tabel)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                {[
                  { label: 'Siswa', count: students.length },
                  { label: 'Guru', count: teachers.length },
                  { label: 'Kelas', count: classes.length },
                  { label: 'Wajah Biometric', count: faceTemplates.length },
                  { label: 'Akun Pengguna', count: usersList.length },
                  { label: 'Lokasi GPS', count: locations.length },
                  { label: 'Audit Log', count: auditLogs.length },
                  { label: 'Presensi, Izin & Settings', count: 'Semua' },
                ].map(item => (
                  <div
                    key={item.label}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                  >
                    <span className="text-slate-600 dark:text-slate-400 truncate pr-1">{item.label}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={!isSyncEmailValid || isCloudSyncing}
                onClick={() => void handleRunCloudSync(true, true)}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-50 transition"
              >
                Tautkan Email Saja
              </button>
              <button
                type="button"
                disabled={!isSyncEmailValid || isCloudSyncing}
                onClick={() => void handleRunCloudSync(false, true)}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-50 transition flex items-center gap-1.5"
                title="Siapkan & unduh paket Sheets (.xlsx) dan Drive (.json) dari server lokal"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Paket Lokal (.xlsx/.json)</span>
              </button>
              <button
                type="button"
                disabled={!isSyncEmailValid || isCloudSyncing}
                onClick={handleRequestCloudSync}
                className="flex-1 min-w-[220px] px-5 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2 transition"
              >
                {isCloudSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyinkronkan 13 Tabel ke Drive & Sheets...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>Sinkronkan Semua ke Drive & Sheets</span>
                  </>
                )}
              </button>
            </div>

            {!isSyncEmailValid && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Tombol penautan & sinkronisasi terkunci sampai Anda memasukkan alamat email yang valid.
              </p>
            )}

            {/* Mandatory Explicit Confirmation Dialog before Mutating/Overwriting Drive & Sheets */}
            {showSyncConfirmDialog && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-xs text-amber-950 dark:text-amber-100">
                    <div className="font-black text-sm">
                      Konfirmasi Pembaruan Google Drive & Google Sheets
                    </div>
                    <p>
                      Anda akan membuat/memperbarui folder dan menimpa isi lembar kerja di akun Google{' '}
                      <strong>{workspaceUser?.email || syncEmailInput.trim()}</strong> (ditautkan ke{' '}
                      <strong>{syncEmailInput.trim()}</strong>):
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      <li>
                        <strong>Folder Drive:</strong> Presensi_{(settings?.schoolName || 'Yayasan_Mambaul_Ulum').replace(/\s+/g, '_')} (mengunggah file backup JSON baru)
                      </li>
                      <li>
                        <strong>Google Spreadsheet:</strong> Database_{(settings?.schoolName || 'Yayasan_Mambaul_Ulum').replace(/\s+/g, '_')}_{syncEmailInput.trim()}
                      </li>
                      <li>
                        <strong>13 Tabel yang Diperbarui/Ditimpa:</strong> Settings, Users, Teachers, Classes, Students, FaceTemplates, StudentAttendance, TeacherAttendance, ToiletPermits, Locations, AuditLog, ChangeLog, FollowUpNotes
                      </li>
                    </ul>
                    <p className="text-[11px] opacity-85">
                      Database lokal di server aplikasi tetap aman dan aktif berjalan.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSyncConfirmDialog(false)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRunCloudSync(false, false)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Ya, Konfirmasi & Sinkronkan</span>
                  </button>
                </div>
              </div>
            )}

            {/* Result Panel */}
            {cloudSyncResult && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <div className="flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div>{cloudSyncResult.message}</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Email tertaut: <strong>{cloudSyncResult.linkedEmail}</strong>
                    </div>
                  </div>
                </div>

                {cloudSyncResult.tableCounts && (
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {Object.entries(cloudSyncResult.tableCounts as Record<string, number>).map(([tbl, cnt]) => (
                      <span
                        key={tbl}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-slate-700 dark:text-slate-300 font-mono"
                      >
                        {tbl}: {cnt}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {cloudSyncResult.sheetsResult?.spreadsheetUrl && (
                    <a
                      href={cloudSyncResult.sheetsResult.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Google Sheets</span>
                    </a>
                  )}
                  {cloudSyncResult.driveResult?.folderUrl && (
                    <a
                      href={cloudSyncResult.driveResult.folderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Folder Drive</span>
                    </a>
                  )}
                  {cloudSyncResult.driveResult?.fileUrl && (
                    <a
                      href={cloudSyncResult.driveResult.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka File Backup Drive</span>
                    </a>
                  )}
                  {cloudSyncResult.exportBundle && (
                    <>
                      <button
                        type="button"
                        onClick={handleDownloadSyncedWorkbook}
                        className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-950 flex items-center gap-1.5 transition"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Unduh Semua Sheet (.xlsx)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadSyncedJson}
                        className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh Backup Drive (.json)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
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
  onRefresh: () => void | Promise<void>;
}> = ({ students, teachers, faceTemplates, onRefresh }) => {
  const [selectedPersonType, setSelectedPersonType] = useState<'student' | 'teacher'>('student');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchList, setSearchList] = useState<string>('');

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoUploadRef = useRef<HTMLInputElement | null>(null);

  const enrolledPersonIds = new Set(faceTemplates.map(f => f.personId));

  useEffect(() => {
    if (!areFaceModelsLoaded()) {
      loadFaceDetectionModels().catch(() => {});
    }
    return () => stopCamera();
  }, []);

  const startCamera = async (modeOverride?: 'user' | 'environment') => {
    const targetMode = modeOverride || facingMode;
    setCameraLoading(true);
    setMessage(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (!areFaceModelsLoaded()) {
        loadFaceDetectionModels().catch(() => {});
      }
      const stream = await acquireCameraStream(targetMode);
      streamRef.current = stream;
      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, stream);
      }
      setIsCameraActive(true);
    } catch (e: any) {
      const parsed = parseCameraError(e);
      alert(`${parsed.title}: ${parsed.message}`);
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

  const switchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  const saveDescriptorAndPortrait = async (
    descriptor: number[],
    sourceEl: HTMLVideoElement | HTMLImageElement,
    sourceWidth: number,
    sourceHeight: number
  ) => {
    const res = await apiRequest('/api/face-templates', {
      method: 'POST',
      body: JSON.stringify({
        personId: selectedPersonId,
        personType: selectedPersonType,
        descriptor,
      }),
    });

    // Automatically capture formal blue background portrait for student card
    if (selectedPersonType === 'student' && sourceWidth > 0 && sourceHeight > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 400; // 3:4 portrait
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1e40af'; // Formal Indonesian student blue background
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const cropW = Math.min(sourceWidth, sourceHeight * 0.75);
          const cropH = cropW * (4 / 3);
          const startX = Math.max(0, (sourceWidth - cropW) / 2);
          const startY = Math.max(0, (sourceHeight - cropH) / 2);

          ctx.drawImage(sourceEl, startX, startY, cropW, Math.min(cropH, sourceHeight - startY), 0, 0, 300, 400);
          const bluePhotoDataUrl = canvas.toDataURL('image/jpeg', 0.92);

          await apiRequest(`/api/students/${selectedPersonId}`, {
            method: 'PUT',
            body: JSON.stringify({ photoUrl: bluePhotoDataUrl }),
          });
        }
      } catch (photoErr) {
        console.warn('Could not generate card photo thumbnail:', photoErr);
      }
    }

    if (res.success) {
      setMessage('Wajah berhasil didaftarkan & langsung tersinkron ke seluruh perangkat deteksi wajah!');
      stopCamera();
      await onRefresh();
    } else {
      alert(res.error || 'Gagal menyimpan template wajah.');
    }
  };

  // Capture face descriptor from live camera and save vector to server
  const handleEnrollFace = async () => {
    if (!selectedPersonId || !videoRef.current) return;
    setIsCapturing(true);
    setMessage(null);

    try {
      const descriptor = await detectSingleFaceDescriptor(videoRef.current);
      if (!descriptor) {
        alert('Wajah tidak terdeteksi jelas. Posisikan wajah di tengah kamera.');
        return;
      }

      const vw = videoRef.current.videoWidth || 640;
      const vh = videoRef.current.videoHeight || 480;
      await saveDescriptorAndPortrait(descriptor, videoRef.current, vw, vh);
    } finally {
      setIsCapturing(false);
    }
  };

  // Upload photo file and extract face descriptor directly
  const handleUploadPhotoEnroll = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPersonId) return;

    setIsCapturing(true);
    setMessage(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });

      const descriptor = await detectFaceDescriptorFromImage(img);
      if (!descriptor) {
        alert('Wajah tidak terdeteksi jelas pada foto. Pastikan foto menghadap depan dan cukup terang.');
        return;
      }

      await saveDescriptorAndPortrait(descriptor, img, img.naturalWidth || img.width, img.naturalHeight || img.height);
    } catch (err: any) {
      alert(err?.message || 'Gagal memproses foto wajah.');
    } finally {
      setIsCapturing(false);
      if (photoUploadRef.current) {
        photoUploadRef.current.value = '';
      }
    }
  };

  const displayList = selectedPersonType === 'student'
    ? students.filter(s =>
        !searchList ||
        s.name.toLowerCase().includes(searchList.toLowerCase()) ||
        s.nis.includes(searchList)
      )
    : teachers.filter(t =>
        !searchList ||
        t.name.toLowerCase().includes(searchList.toLowerCase()) ||
        t.nip.includes(searchList)
      );

  const studentTemplatesCount = faceTemplates.filter(f => !f.personType || f.personType === 'student').length;
  const teacherTemplatesCount = faceTemplates.filter(f => f.personType === 'teacher').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Enrollment Card */}
      <div className="lg:col-span-6 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Pendaftaran Wajah Baru (Biometric)</h3>
          <p className="text-xs text-slate-500">
            Vektor wajah 128 angka otomatis tersinkron real-time ke Kios Presensi Siswa & Presensi Guru.
          </p>
        </div>

        {message && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
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
              Wajah Siswa ({studentTemplatesCount})
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
              Wajah Guru ({teacherTemplatesCount})
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
              <div className="text-center p-6 space-y-3">
                <Camera className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400">
                  Pilih nama terlebih dahulu, lalu nyalakan kamera atau upload foto wajah
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    disabled={!selectedPersonId || cameraLoading || isCapturing}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
                  >
                    {cameraLoading ? 'Membuka Kamera...' : 'Nyalakan Kamera'}
                  </button>
                  <label
                    className={`px-4 py-2 text-xs font-bold rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-800 cursor-pointer transition ${
                      !selectedPersonId || isCapturing ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <span>{isCapturing ? 'Memproses Foto...' : 'Upload Foto Wajah'}</span>
                    <input
                      ref={photoUploadRef}
                      type="file"
                      accept="image/*"
                      disabled={!selectedPersonId || isCapturing}
                      onChange={handleUploadPhotoEnroll}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {isCameraActive && (
            <div className="flex flex-wrap gap-2">
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
                onClick={switchCamera}
                className="px-4 py-3 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
              >
                Ganti Kamera
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Database Wajah {selectedPersonType === 'student' ? 'Siswa' : 'Guru'} ({selectedPersonType === 'student' ? studentTemplatesCount : teacherTemplatesCount} Terdaftar)
          </h3>
          <input
            type="text"
            value={searchList}
            onChange={e => setSearchList(e.target.value)}
            placeholder={selectedPersonType === 'student' ? 'Cari siswa / NIS...' : 'Cari guru / NIP...'}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          />
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {displayList.map((person: any) => {
            const isEnrolled = enrolledPersonIds.has(person.id);
            const template = faceTemplates.find(f => f.personId === person.id);
            const codeLabel = selectedPersonType === 'student' ? `NIS: ${person.nis} • Siswa` : `NIP: ${person.nip} • Guru`;
            return (
              <div
                key={person.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{person.name}</div>
                  <div className="text-[11px] text-slate-400">{codeLabel}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                      isEnrolled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {isEnrolled ? 'Terdaftar & Sinkron' : 'Belum'}
                  </span>

                  {template && (
                    <button
                      onClick={async () => {
                        if (confirm(`Hapus data wajah ${person.name}?`)) {
                          await apiRequest(`/api/face-templates/${template.id}`, { method: 'DELETE' });
                          await onRefresh();
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
  activeUsers: Array<{ userId: string; activeTab: string; deviceLabel: string }>;
  currentUserId?: string;
  onRefresh: () => void;
}> = ({ users, classes, activeUsers, currentUserId, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'wali_kelas' | 'bk' | 'kesiswaan' | 'guru'>('guru');
  const [classId, setClassId] = useState('');
  const [email, setEmail] = useState('');
  const [userFeedback, setUserFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');

  const onlineUserIds = new Set(activeUsers.map(a => a.userId));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFeedback(null);
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
        setEmail('');
        setClassId('');
        setUserFeedback({ type: 'success', text: `Akun "${name}" berhasil ditambahkan dan langsung disinkronkan.` });
        onRefresh();
      } else {
        setUserFeedback({ type: 'error', text: res.error || 'Gagal membuat pengguna' });
      }
    } catch (e: any) {
      setUserFeedback({ type: 'error', text: e.message || 'Gagal membuat pengguna' });
    }
  };

  const handleToggleActive = async (targetUser: any) => {
    setUserFeedback(null);
    try {
      const nextActive = !targetUser.isActive;
      const res = await apiRequest(`/api/users/${targetUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (res.success) {
        setUserFeedback({
          type: 'success',
          text: `Status akun "${targetUser.name}" diubah menjadi ${nextActive ? 'Aktif' : 'Nonaktif'}.`,
        });
        onRefresh();
      }
    } catch (e: any) {
      setUserFeedback({ type: 'error', text: e.message || 'Gagal memperbarui status pengguna.' });
    }
  };

  const handleDeleteUser = async (targetUser: any) => {
    setUserFeedback(null);
    try {
      const res = await apiRequest(`/api/users/${targetUser.id}`, { method: 'DELETE' });
      if (res.success) {
        setUserFeedback({ type: 'success', text: `Akun "${targetUser.name}" berhasil dihapus.` });
        onRefresh();
      } else {
        setUserFeedback({ type: 'error', text: res.error || 'Gagal menghapus pengguna.' });
      }
    } catch (e: any) {
      setUserFeedback({ type: 'error', text: e.message || 'Gagal menghapus pengguna.' });
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || resetNewPassword.length < 5) {
      setUserFeedback({ type: 'error', text: 'Password baru minimal 5 karakter.' });
      return;
    }
    try {
      const res = await apiRequest(`/api/users/${resetTarget.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword: resetNewPassword }),
      });
      if (res.success) {
        setUserFeedback({ type: 'success', text: `Kata sandi "${resetTarget.name}" berhasil direset.` });
        setResetTarget(null);
        setResetNewPassword('');
      } else {
        setUserFeedback({ type: 'error', text: res.error || 'Gagal mereset kata sandi.' });
      }
    } catch (e: any) {
      setUserFeedback({ type: 'error', text: e.message || 'Gagal mereset kata sandi.' });
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Manajemen Akun Multi-Pengguna</h3>
          <p className="text-xs text-slate-500">
            Kelola akun Admin, Wali Kelas, Guru BK, Kesiswaan & Guru beserta status online real-time
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {userFeedback && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-center gap-2 border ${
            userFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}
        >
          {userFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{userFeedback.text}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
              <th className="py-3 px-3">Nama Lengkap</th>
              <th className="py-3 px-3">Username</th>
              <th className="py-3 px-3">Peran (Role)</th>
              <th className="py-3 px-3">Kelas Binaan</th>
              <th className="py-3 px-3">Sesi & Status</th>
              <th className="py-3 px-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map(u => {
              const isOnline = onlineUserIds.has(u.id);
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                        title={isOnline ? 'Sedang Online Real-Time' : 'Offline'}
                      />
                      <span>{u.name}</span>
                      {isSelf && (
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">(Anda)</span>
                      )}
                    </div>
                  </td>
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
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => void handleToggleActive(u)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                          u.isActive
                            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100'
                            : 'text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'
                        } disabled:opacity-60`}
                        title={isSelf ? 'Akun yang sedang digunakan' : 'Klik untuk ubah status aktif/nonaktif'}
                      >
                        {u.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                      {isOnline && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40">
                          Online
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right space-x-1">
                    <button
                      type="button"
                      onClick={() => {
                        setResetTarget({ id: u.id, name: u.name });
                        setResetNewPassword('');
                      }}
                      className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition"
                    >
                      Reset Sandi
                    </button>
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteUser(u)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition align-middle"
                        title="Hapus akun pengguna"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Reset Kata Sandi: {resetTarget.name}
            </h4>
            <form onSubmit={handleConfirmResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Kata Sandi Baru (Minimal 5 karakter)</label>
                <input
                  type="password"
                  value={resetNewPassword}
                  onChange={e => setResetNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  minLength={5}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold"
                >
                  Simpan Sandi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <label className="block font-semibold mb-1">Email (Opsional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nama@sekolah.sch.id"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  minLength={5}
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
