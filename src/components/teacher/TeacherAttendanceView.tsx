import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  History,
  FileText,
  Navigation,
  RefreshCw,
  LogOut,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSync } from '../../context/SyncContext.tsx';
import { Teacher, TeacherAttendance, SchoolLocation } from '../../types/index.ts';
import { apiRequest } from '../../lib/api.ts';
import {
  loadFaceDetectionModels,
  detectSingleFaceDescriptor,
  findBestFaceMatch,
  parseCameraError,
} from '../../lib/faceDetection.ts';
import { playSuccessChime, playErrorBeep } from '../../lib/soundEffects.ts';

export interface TeacherAttendanceViewProps {
  onReturnToPortal?: () => void;
}

export const TeacherAttendanceView: React.FC<TeacherAttendanceViewProps> = ({ onReturnToPortal }) => {
  const { user } = useAuth();
  const { settings, triggerSync } = useSync();

  // Location state
  const [gpsLoading, setGpsLoading] = useState<boolean>(true);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locations, setLocations] = useState<SchoolLocation[]>([]);
  const [nearestLocation, setNearestLocation] = useState<{ location: SchoolLocation; distanceMeters: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Camera & Face state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<{ title: string; message: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // History & Form
  const [history, setHistory] = useState<TeacherAttendance[]>([]);
  const [teacherFaceTemplate, setTeacherFaceTemplate] = useState<Array<{ personId: string; descriptor: number[] }>>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Leave / Sick modal
  const [showPermitModal, setShowPermitModal] = useState<boolean>(false);
  const [permitType, setPermitType] = useState<'Izin' | 'Sakit'>('Izin');
  const [permitNotes, setPermitNotes] = useState<string>('');

  // Fetch school locations & teacher attendance history
  const loadData = useCallback(async () => {
    try {
      const [locRes, histRes, faceRes] = await Promise.all([
        apiRequest<SchoolLocation[]>('/api/locations'),
        apiRequest<TeacherAttendance[]>('/api/attendance/teacher/history'),
        apiRequest<any[]>('/api/face-templates'),
      ]);

      if (locRes.success && locRes.data) setLocations(locRes.data);
      if (histRes.success && histRes.data) setHistory(histRes.data);
      if (faceRes.success && faceRes.data) {
        setTeacherFaceTemplate(faceRes.data.filter((f: any) => f.personType === 'teacher'));
      }
    } catch (err) {
      console.error('Error loading teacher attendance data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Request GPS Geolocation
  const requestLocation = useCallback(() => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Perangkat Anda tidak mendukung fitur Geolocation GPS.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        setGpsLoading(false);
      },
      err => {
        setGpsLoading(false);
        setGpsError('Gagal mendapatkan lokasi GPS. Pastikan izin lokasi telah aktif.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Calculate nearest location when coords and locations change
  useEffect(() => {
    if (!currentCoords || locations.length === 0) return;

    let min = Infinity;
    let best: SchoolLocation | null = null;

    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371e3;

    for (const loc of locations.filter(l => l.isActive)) {
      const dLat = toRad(loc.latitude - currentCoords.lat);
      const dLon = toRad(loc.longitude - currentCoords.lng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(currentCoords.lat)) * Math.cos(toRad(loc.latitude)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = Math.round(R * c);

      if (dist < min) {
        min = dist;
        best = loc;
      }
    }

    if (best) {
      setNearestLocation({ location: best, distanceMeters: min });
    }
  }, [currentCoords, locations]);

  // Start Camera for Face Verification
  const startCamera = async () => {
    setCameraError(null);
    setCameraLoading(true);
    try {
      await loadFaceDetectionModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      setCameraError(parseCameraError(err));
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

  // Submit Check-In or Check-Out
  const handleAttendanceSubmit = async (actionType: 'checkIn' | 'checkOut') => {
    setIsSubmitting(true);
    setFeedback(null);

    try {
      // 1. Verify GPS radius
      if (nearestLocation && nearestLocation.distanceMeters > nearestLocation.location.radiusMeters) {
        playErrorBeep();
        setFeedback({
          type: 'error',
          message: `Di luar radius: Jarak Anda ${nearestLocation.distanceMeters}m dari ${nearestLocation.location.name} (Batas: ${nearestLocation.location.radiusMeters}m).`,
        });
        setIsSubmitting(false);
        return;
      }

      // 2. Face verification if camera active
      let photoBase64: string | undefined = undefined;
      if (isCameraActive && videoRef.current) {
        const descriptor = await detectSingleFaceDescriptor(videoRef.current);
        if (!descriptor) {
          playErrorBeep();
          setFeedback({
            type: 'error',
            message: 'Wajah tidak terdeteksi jelas pada kamera. Hadapkan wajah tegak ke kamera.',
          });
          setIsSubmitting(false);
          return;
        }

        // Verify face against enrolled templates if available
        if (teacherFaceTemplate.length > 0) {
          const match = findBestFaceMatch(descriptor, teacherFaceTemplate);
          if (!match || !match.isMatch) {
            playErrorBeep();
            setFeedback({
              type: 'error',
              message: 'Wajah tidak cocok dengan template biometric guru yang terdaftar.',
            });
            setIsSubmitting(false);
            return;
          }
        }

        // Capture photo proof if enabled in settings
        if (settings?.teacherPhotoProofEnabled) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
          }
        }
      }

      // 3. Send request to API
      const res = await apiRequest<{ message: string; attendance: TeacherAttendance }>('/api/attendance/teacher', {
        method: 'POST',
        body: JSON.stringify({
          actionType,
          latitude: currentCoords?.lat,
          longitude: currentCoords?.lng,
          photoBase64,
        }),
      });

      if (res.success) {
        playSuccessChime();
        confetti({ particleCount: 70, spread: 60 });
        setFeedback({ type: 'success', message: res.message || 'Presensi berhasil dicatat.' });
        stopCamera();
        await loadData();
        triggerSync();
      } else {
        playErrorBeep();
        setFeedback({ type: 'error', message: res.error || 'Gagal memproses presensi.' });
      }
    } catch (err: any) {
      playErrorBeep();
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Leave / Sick request
  const handleSavePermit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiRequest('/api/attendance/teacher', {
        method: 'POST',
        body: JSON.stringify({
          actionType: 'permit',
          permitType,
          notes: permitNotes,
        }),
      });

      if (res.success) {
        playSuccessChime();
        setShowPermitModal(false);
        setPermitNotes('');
        setFeedback({ type: 'success', message: `Pengajuan ${permitType} berhasil diajukan.` });
        await loadData();
        triggerSync();
      } else {
        alert(res.error || 'Gagal mengajukan izin.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Today's attendance status
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = history.find(h => h.date === todayStr);

  const isInsideRadius = nearestLocation
    ? nearestLocation.distanceMeters <= nearestLocation.location.radiusMeters
    : false;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          {onReturnToPortal && (
            <button
              onClick={onReturnToPortal}
              className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition flex items-center gap-2 font-bold text-xs"
              title="Kembali ke Menu Pilihan Presensi"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Menu Pilihan</span>
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-indigo-500/20">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Presensi Guru & Pegawai
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selamat datang, <strong>{user?.name || 'Bapak/Ibu Guru'}</strong> • Validasi Wajah & Geofence GPS
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowPermitModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition"
        >
          <FileText className="w-4 h-4" />
          <span>Ajukan Izin / Sakit</span>
        </button>
      </div>

      {/* Main Grid: Left GPS + Camera Action, Right History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: GPS & Verification (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Geolocation Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Lokasi Presensi GPS</h3>
              </div>
              <button
                onClick={requestLocation}
                disabled={gpsLoading}
                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg transition"
                title="Refresh Lokasi GPS"
              >
                <RefreshCw className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* GPS Result Box */}
            {gpsLoading ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 flex items-center gap-3">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span>Mendeteksi koordinat GPS perangkat Anda...</span>
              </div>
            ) : gpsError ? (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                {gpsError}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Titik Sekolah Terdekat:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {nearestLocation?.location.name || 'Kampus Sekolah'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Jarak Saat Ini:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {nearestLocation?.distanceMeters ?? '-'} meter
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Status Radius (Maks {nearestLocation?.location.radiusMeters}m):</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                      isInsideRadius
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {isInsideRadius ? 'Di Dalam Radius (Valid)' : 'Di Luar Radius (Ditolak)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Camera View Card */}
          <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl min-h-[300px] flex flex-col items-center justify-center p-6 text-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full max-w-sm rounded-2xl object-cover ${isCameraActive ? 'block' : 'hidden'}`}
            />

            {!isCameraActive && (
              <div className="space-y-4 max-w-sm">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">Kamera Verifikasi Wajah</h4>
                  <p className="text-xs text-slate-400">
                    Gunakan kamera depan untuk verifikasi wajah biometric presensi guru.
                  </p>
                </div>

                {cameraError && (
                  <div className="p-3 rounded-xl bg-red-950 border border-red-800 text-xs text-red-300 text-left">
                    {cameraError.message}
                  </div>
                )}

                <button
                  onClick={startCamera}
                  disabled={cameraLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow"
                >
                  {cameraLoading ? 'Memuat Model...' : 'Aktifkan Kamera'}
                </button>
              </div>
            )}

            {isCameraActive && (
              <button
                onClick={stopCamera}
                className="mt-3 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition"
              >
                Tutup Kamera
              </button>
            )}
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl border text-xs flex items-center gap-3 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Action Buttons: Presensi Masuk & Presensi Pulang */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleAttendanceSubmit('checkIn')}
              disabled={isSubmitting || (todayRecord && todayRecord.timeIn !== '')}
              className="py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition text-center"
            >
              <div className="text-base">Presensi Masuk</div>
              <div className="text-[11px] font-normal opacity-80 mt-0.5">
                {todayRecord?.timeIn ? `Sudah Masuk (${todayRecord.timeIn})` : 'Klik untuk masuk'}
              </div>
            </button>

            <button
              onClick={() => handleAttendanceSubmit('checkOut')}
              disabled={isSubmitting || !todayRecord || (todayRecord && todayRecord.timeOut !== undefined)}
              className="py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/20 disabled:opacity-50 transition text-center"
            >
              <div className="text-base">Presensi Pulang</div>
              <div className="text-[11px] font-normal opacity-80 mt-0.5">
                {todayRecord?.timeOut ? `Sudah Pulang (${todayRecord.timeOut})` : 'Klik saat jam pulang'}
              </div>
            </button>
          </div>
        </div>

        {/* Right Column: Attendance History (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Riwayat Presensi Pribadi</h3>
            </div>
            <span className="text-xs text-slate-400">{history.length} Catatan</span>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Belum ada catatan riwayat presensi.
              </div>
            ) : (
              history.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{item.date}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        item.status === 'Tepat Waktu'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : item.status === 'Terlambat'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Masuk: {item.timeIn || '-'}</span>
                    <span>Pulang: {item.timeOut || '-'}</span>
                  </div>
                  {item.notes && (
                    <div className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      {item.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Leave / Sick Modal */}
      {showPermitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Pengajuan Izin / Sakit Guru</h3>
            <p className="text-xs text-slate-500 mb-4">
              Pengajuan akan langsung tercatat pada dashboard kepala sekolah / admin.
            </p>

            <form onSubmit={handleSavePermit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jenis Pengajuan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPermitType('Izin')}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      permitType === 'Izin'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Izin Keperluan
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermitType('Sakit')}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      permitType === 'Sakit'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Sakit
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Keterangan / Alasan
                </label>
                <textarea
                  value={permitNotes}
                  onChange={e => setPermitNotes(e.target.value)}
                  placeholder="Keterangan pengajuan..."
                  rows={3}
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPermitModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow"
                >
                  {isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
