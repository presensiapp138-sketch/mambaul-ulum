import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Camera,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Search,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  LogOut,
  Sparkles,
  Maximize2,
  Calendar,
  Volume2,
  VolumeX,
  ArrowLeft,
} from 'lucide-react';
import { Student, StudentAttendance, ToiletPermit, SchoolClass } from '../../types/index.ts';
import { useSync } from '../../context/SyncContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import {
  loadFaceDetectionModels,
  detectFacesInVideo,
  findBestFaceMatch,
  parseCameraError,
  DetectedFaceResult,
} from '../../lib/faceDetection.ts';
import { useHardwareBarcodeScanner } from '../../lib/barcodeListener.ts';
import { playSuccessChime, playErrorBeep, playWarningTone, playScanClick } from '../../lib/soundEffects.ts';

export interface StudentKioskViewProps {
  onReturnToPortal?: () => void;
}

export const StudentKioskView: React.FC<StudentKioskViewProps> = ({ onReturnToPortal }) => {
  const { settings, todayAttendance, activePermits, triggerSync } = useSync();

  // Kiosk flow states
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<{ title: string; message: string } | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Video & Canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef<boolean>(false);
  const lastDetectTimeRef = useRef<number>(0);

  // Cached face templates and student list
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [faceTemplates, setFaceTemplates] = useState<Array<{ personId: string; descriptor: number[] }>>([]);

  // Current detected students in frame
  const [detectedStudentsInFrame, setDetectedStudentsInFrame] = useState<Array<{ student: Student; distance: number }>>([]);
  const [hasFaceInFrame, setHasFaceInFrame] = useState<boolean>(false);

  // Manual Scan Input fallback
  const [manualCardInput, setManualCardInput] = useState('');
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  } | null>(null);

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [showToiletModal, setShowToiletModal] = useState(false);

  // Real-time Clock
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
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial students, classes, and face templates
  const fetchData = useCallback(async () => {
    try {
      const [stdRes, clsRes, faceRes] = await Promise.all([
        apiRequest<Student[]>('/api/students'),
        apiRequest<SchoolClass[]>('/api/classes'),
        apiRequest<Array<{ personId: string; descriptor: number[] }>>('/api/face-templates'),
      ]);
      if (stdRes.success && stdRes.data) setStudents(stdRes.data);
      if (clsRes.success && clsRes.data) setClasses(clsRes.data);
      if (faceRes.success && faceRes.data) setFaceTemplates(faceRes.data);
    } catch (e) {
      console.error('Failed to load kiosk data:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Preload face models in background immediately on kiosk mount for instant camera readiness
  useEffect(() => {
    let isMounted = true;
    loadFaceDetectionModels()
      .then(ok => {
        if (isMounted) setModelStatus(ok ? 'ready' : 'error');
      })
      .catch(() => {
        if (isMounted) setModelStatus('error');
      });

    // Auto-attempt fast camera activation on kiosk mount
    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, []);

  // Activate Camera with high-speed parallel loading & lean stream constraints
  const startCamera = async () => {
    setCameraError(null);
    setCameraLoading(true);

    try {
      // Lean video constraints so browser negotiates stream in milliseconds
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      };

      // Run media stream acquisition and face-api model loading simultaneously
      const [stream, modelOk] = await Promise.all([
        navigator.mediaDevices.getUserMedia(constraints),
        loadFaceDetectionModels(),
      ]);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.warn);
        };
        await videoRef.current.play().catch(console.warn);
      }

      setIsCameraActive(true);
      setCameraLoading(false);
      setModelStatus(modelOk ? 'ready' : 'error');
      startDetectionLoop();
    } catch (err: any) {
      setCameraLoading(false);
      setIsCameraActive(false);
      setCameraError(parseCameraError(err));
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsCameraActive(false);
    setDetectedStudentsInFrame([]);
    setHasFaceInFrame(false);
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (isCameraActive) {
      setTimeout(() => startCamera(), 100);
    }
  };

  // Real-time Detection Loop (non-blocking 60fps video with throttled ~120ms async face detection)
  const startDetectionLoop = () => {
    const runFrame = () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
        animFrameRef.current = requestAnimationFrame(runFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const now = performance.now();

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        // Throttle face-api processing to once every 120ms so CPU/GPU runs cool and video never stutters
        if (!isDetectingRef.current && now - lastDetectTimeRef.current >= 120) {
          isDetectingRef.current = true;
          lastDetectTimeRef.current = now;

          detectFacesInVideo(video)
            .then(detections => {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const recognizedStudents: Array<{ student: Student; distance: number }> = [];

                if (detections.length > 0) {
                  setHasFaceInFrame(true);

                  detections.forEach(det => {
                    const { box, descriptor } = det;
                    const match = findBestFaceMatch(descriptor, faceTemplates);

                    let studentName = 'Tidak Dikenali';
                    let className = '';
                    let isMatched = false;

                    if (match && match.isMatch) {
                      const foundStudent = students.find(s => s.id === match.personId);
                      if (foundStudent) {
                        studentName = foundStudent.name;
                        const cls = classes.find(c => c.id === foundStudent.classId);
                        className = cls ? cls.name : '';
                        isMatched = true;
                        recognizedStudents.push({ student: foundStudent, distance: match.distance });
                      }
                    }

                    // Draw bounding box
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = isMatched ? '#10b981' : '#f59e0b';
                    ctx.strokeRect(box.x, box.y, box.width, box.height);

                    // Draw tag label
                    const label = className ? `${studentName} (${className})` : studentName;
                    ctx.font = 'bold 14px Inter, sans-serif';
                    const textWidth = ctx.measureText(label).width;
                    ctx.fillStyle = isMatched ? '#10b981' : '#f59e0b';
                    ctx.fillRect(box.x, box.y > 28 ? box.y - 28 : box.y, textWidth + 16, 26);

                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(label, box.x + 8, box.y > 28 ? box.y - 10 : box.y + 18);
                  });
                } else {
                  setHasFaceInFrame(false);
                }

                setDetectedStudentsInFrame(recognizedStudents);
              }
            })
            .catch(err => {
              console.debug('Face detection cycle error:', err);
            })
            .finally(() => {
              isDetectingRef.current = false;
            });
        }
      }

      animFrameRef.current = requestAnimationFrame(runFrame);
    };

    animFrameRef.current = requestAnimationFrame(runFrame);
  };

  // Process Card/Barcode Scan
  const handleScanCard = useCallback(
    async (scannedCode: string) => {
      const code = scannedCode.trim();
      if (!code) return;

      playScanClick();

      // Check if code matches any student
      const matchedStudent = students.find(
        s => s.barcodeCard.toLowerCase() === code.toLowerCase() ||
             s.nis.toLowerCase() === code.toLowerCase()
      );

      if (!matchedStudent) {
        if (soundEnabled) playErrorBeep();
        setStatusFeedback({
          type: 'error',
          title: 'Kartu Tidak Dikenali',
          message: `Kode "${code}" tidak terdaftar pada siswa manapun.`,
        });
        return;
      }

      // Check face verification:
      // If camera is running and face templates exist, verify that the scanned student is among the detected faces in frame!
      if (isCameraActive && faceTemplates.length > 0) {
        const studentHasTemplate = faceTemplates.some(t => t.personId === matchedStudent.id);
        if (studentHasTemplate && detectedStudentsInFrame.length > 0) {
          const studentFacePresent = detectedStudentsInFrame.some(
            d => d.student.id === matchedStudent.id
          );

          if (!studentFacePresent) {
            if (soundEnabled) playErrorBeep();
            setStatusFeedback({
              type: 'error',
              title: 'Wajah Tidak Cocok dengan Kartu',
              message: `Wajah yang terdeteksi di kamera bukan milik ${matchedStudent.name}. Presensi dibatalkan.`,
            });
            return;
          }
        }
      }

      // Record student attendance to API
      try {
        const res = await apiRequest<{
          attendance: StudentAttendance;
          student: Student;
          message: string;
        }>('/api/attendance/student', {
          method: 'POST',
          body: JSON.stringify({
            studentId: matchedStudent.id,
            barcodeCard: code,
            method: 'FACE_SCAN',
          }),
        });

        if (res.success) {
          if (soundEnabled) playSuccessChime();
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });

          setStatusFeedback({
            type: 'success',
            title: res.attendance.status === 'Terlambat' ? 'Presensi Terlambat' : 'Presensi Berhasil!',
            message: `${res.student.name} (${res.attendance.timeIn}) - Status: ${res.attendance.status}`,
          });

          triggerSync();
        } else {
          if (soundEnabled) playErrorBeep();
          setStatusFeedback({
            type: 'error',
            title: 'Presensi Ditolak',
            message: res.error || 'Gagal merekam presensi.',
          });
        }
      } catch (err: any) {
        if (soundEnabled) playErrorBeep();
        setStatusFeedback({
          type: 'error',
          title: 'Presensi Gagal',
          message: err.message || 'Terjadi kesalahan sistem.',
        });
      }
    },
    [students, faceTemplates, isCameraActive, detectedStudentsInFrame, soundEnabled, triggerSync]
  );

  // Hardware Scanner USB / RFID Hook (Auto-submits instantly on match or after 80ms scanner stream, no Enter required)
  useHardwareBarcodeScanner(handleScanCard, true, {
    matchDirectly: (candidate: string) => {
      const clean = candidate.trim().toLowerCase();
      return students.some(
        s => s.barcodeCard.toLowerCase() === clean || s.nis.toLowerCase() === clean
      );
    },
    autoSubmitDelayMs: 80,
  });

  // Auto clear feedback after 6 seconds
  useEffect(() => {
    if (statusFeedback) {
      const timer = setTimeout(() => {
        setStatusFeedback(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [statusFeedback]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      {/* Top Banner / Time Header */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
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
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-500/20">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {settings?.schoolName || 'Yayasan Mambaul Ulum'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {settings?.foundationAddress ? `${settings.foundationAddress} • ` : ''}Tahun Ajaran {settings?.academicYear} • Batas Hadir: {settings?.lateCutoffTime} WIB
            </p>
          </div>
        </div>

        {/* Realtime Clock & Date Display */}
        <div className="flex items-center gap-4 text-right">
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{currentDate}</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {currentTime || '--:--:--'}
            </div>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
            title={soundEnabled ? 'Matikan Suara' : 'Aktifkan Suara'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-500" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Main Kiosk Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Scanner & Large Scan Prompt (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Camera View Card */}
          <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl min-h-[380px] sm:min-h-[460px] flex flex-col items-center justify-center">
            {/* Video & Canvas Elements */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover rounded-3xl ${isCameraActive ? 'block' : 'hidden'}`}
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${isCameraActive ? 'block' : 'hidden'}`}
            />

            {/* Inactive State: "Mulai Presensi" Button */}
            {!isCameraActive && (
              <div className="p-8 text-center space-y-5 max-w-md">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-lg">
                  <Camera className="w-10 h-10 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-bold text-white">Deteksi Wajah & Scan Kartu</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Kamera hanya aktif atas izin Anda di memori browser. Foto tidak pernah disimpan atau dikirim ke server.
                  </p>
                </div>

                {cameraError && (
                  <div className="p-3.5 rounded-2xl bg-red-950/70 border border-red-800 text-left text-xs text-red-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-red-200">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{cameraError.title}</span>
                    </div>
                    <p>{cameraError.message}</p>
                  </div>
                )}

                <button
                  onClick={startCamera}
                  disabled={cameraLoading}
                  className="w-full py-4 px-6 rounded-2xl text-base font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-3"
                >
                  {cameraLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Memulai Kamera...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5" />
                      <span>Aktifkan Kamera & Mulai</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Controls Bar over Active Video */}
            {isCameraActive && (
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs font-medium border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Kamera Aktif • Deteksi Realtime</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={switchCamera}
                    className="p-2 rounded-xl bg-black/60 backdrop-blur-md text-white hover:bg-black/80 border border-white/10 transition"
                    title="Ganti Kamera Depan/Belakang"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-3 py-1.5 rounded-xl bg-red-600/80 backdrop-blur-md text-white hover:bg-red-700 text-xs font-semibold transition"
                  >
                    Hentikan
                  </button>
                </div>
              </div>
            )}

            {/* Privacy Badge overlay */}
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-slate-400 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/5 pointer-events-none">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Privasi Terjamin: Video hanya di browser, tidak ada foto disimpan.
              </span>
              <span>Model: Local TinyFace</span>
            </div>
          </div>

          {/* Large Prompt Step Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold uppercase tracking-wider">
                  Langkah 2 dari 2
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  Silakan SCAN Kartu / Barcode / RFID Anda
                </h2>
                <p className="text-xs sm:text-sm text-blue-100">
                  Dekatkan kartu ke scanner scanner fisik USB/RFID atau ketikkan kode kartu di bawah.
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center flex-shrink-0">
                <QrCode className="w-8 h-8" />
              </div>
            </div>

            {/* Quick manual scan input for fallback without hardware scanner */}
            <div className="mt-5 pt-4 border-t border-white/15 flex gap-2">
              <input
                id="scanner-trap-input"
                type="text"
                value={manualCardInput}
                onChange={e => setManualCardInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleScanCard(manualCardInput);
                    setManualCardInput('');
                  }
                }}
                placeholder="Scan / Ketik nomor kartu siswa (lalu Enter)..."
                className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <button
                onClick={() => {
                  handleScanCard(manualCardInput);
                  setManualCardInput('');
                }}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-white text-blue-700 hover:bg-blue-50 transition shadow"
              >
                Scan
              </button>
            </div>
          </div>

          {/* Feedback Popup Alert */}
          {statusFeedback && (
            <div
              className={`p-5 rounded-3xl border shadow-lg animate-in slide-in-from-top-4 duration-200 flex items-start gap-4 ${
                statusFeedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                  : statusFeedback.type === 'error'
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
              }`}
            >
              <div
                className={`p-2 rounded-xl flex-shrink-0 ${
                  statusFeedback.type === 'success'
                    ? 'bg-emerald-500 text-white'
                    : statusFeedback.type === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {statusFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold">{statusFeedback.title}</h4>
                <p className="text-sm opacity-90 mt-0.5">{statusFeedback.message}</p>
              </div>
            </div>
          )}

          {/* Quick Action Buttons: Presensi Manual & Izin Toilet */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setShowManualModal(true)}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 transition shadow-sm text-left group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Petugas Piket</span>
                <Users className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition" />
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-base">Presensi Manual</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Input Izin, Sakit, Alpa oleh guru/petugas
              </div>
            </button>

            <button
              onClick={() => setShowToiletModal(true)}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500 transition shadow-sm text-left group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Timer Izin</span>
                <Clock className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition" />
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-base">Izin ke Toilet</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Catat keluar & timer kembali (Maks {settings?.toiletMaxMinutes}m)
              </div>
            </button>
          </div>
        </div>

        {/* Right Column: Live "Sudah Presensi Hari Ini" & Students in Toilet (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Toilet Permits Live Card */}
          {activePermits.length > 0 && (
            <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                    Sedang di Toilet ({activePermits.length} Siswa)
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  Maksimal {settings?.toiletMaxMinutes} menit
                </span>
              </div>

              <div className="space-y-2">
                {activePermits.map(permit => (
                  <div
                    key={permit.id}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{permit.studentName}</div>
                      <div className="text-slate-500">Keluar pukul {permit.timeOut} WIB</div>
                    </div>
                    <button
                      onClick={async () => {
                        const res = await apiRequest<{ message: string; exceeded: boolean }>('/api/toilet/return', {
                          method: 'POST',
                          body: JSON.stringify({ permitId: permit.id }),
                        });
                        if (res.success) {
                          if (res.exceeded) {
                            playWarningTone();
                          } else {
                            playSuccessChime();
                          }
                          triggerSync();
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition"
                    >
                      Kembali
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* "Sudah Presensi Hari Ini" Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Sudah Presensi Hari Ini
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total {todayAttendance.length} siswa telah tercatat
                </p>
              </div>
              <button
                onClick={() => triggerSync()}
                className="p-2 text-slate-400 hover:text-blue-600 rounded-xl transition"
                title="Refresh Daftar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {todayAttendance.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Belum ada siswa yang presensi hari ini.
                </div>
              ) : (
                todayAttendance.map(item => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between transition hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs">
                        {item.studentName ? item.studentName.charAt(0) : 'S'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {item.studentName || 'Siswa'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.className ? `${item.className} • ` : ''}
                          NIS: {item.studentNis || '-'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          item.status === 'Hadir'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : item.status === 'Terlambat'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        }`}
                      >
                        {item.status}
                      </span>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">{item.timeIn}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Attendance Modal */}
      {showManualModal && (
        <ManualAttendanceModal
          classes={classes}
          students={students}
          onClose={() => setShowManualModal(false)}
          onSuccess={() => {
            setShowManualModal(false);
            triggerSync();
          }}
        />
      )}

      {/* Toilet Permit Modal */}
      {showToiletModal && (
        <ToiletPermitModal
          students={students}
          classes={classes}
          onClose={() => setShowToiletModal(false)}
          onSuccess={() => {
            setShowToiletModal(false);
            triggerSync();
          }}
        />
      )}
    </div>
  );
};

// Modal: Presensi Manual (Petugas Piket)
const ManualAttendanceModal: React.FC<{
  classes: SchoolClass[];
  students: Student[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ classes, students, onClose, onSuccess }) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [status, setStatus] = useState<'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa'>('Izin');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredStudents = students.filter(s => s.classId === selectedClassId && s.isActive);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setError('Pilih siswa terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiRequest('/api/attendance/student/manual', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudentId,
          status,
          notes,
        }),
      });

      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Gagal menyimpan presensi manual.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Presensi Manual Petugas</h3>
        <p className="text-xs text-slate-500 mb-5">
          Tercatat sebagai metode MANUAL dan masuk ke dalam AuditLog.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pilih Kelas
            </label>
            <select
              value={selectedClassId}
              onChange={e => {
                setSelectedClassId(e.target.value);
                setSelectedStudentId('');
              }}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pilih Siswa
            </label>
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              <option value="">-- Pilih Siswa ({filteredStudents.length} siswa) --</option>
              {filteredStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nis} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Status Presensi
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {(['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa'] as const).map(st => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setStatus(st)}
                  className={`py-2 text-xs font-bold rounded-xl border transition ${
                    status === st
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Keterangan / Alasan
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contoh: Sakit demam ada surat dokter"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Presensi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal: Izin ke Toilet
const ToiletPermitModal: React.FC<{
  students: Student[];
  classes: SchoolClass[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ students, classes, onClose, onSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = students
    .filter(
      s =>
        s.isActive &&
        (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.nis.includes(searchTerm) ||
          s.barcodeCard.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .slice(0, 8);

  const handleStartPermit = async () => {
    if (!selectedStudent) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiRequest('/api/toilet/start', {
        method: 'POST',
        body: JSON.stringify({ studentId: selectedStudent.id }),
      });

      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Gagal mencatat izin keluar toilet.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Izin Keluar ke Toilet</h3>
        <p className="text-xs text-slate-500 mb-4">
          Pilih siswa yang akan keluar. Timer durasi akan otomatis berjalan.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari nama / NIS / scan kartu siswa..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {filtered.map(s => {
              const cls = classes.find(c => c.id === s.classId);
              const isSelected = selectedStudent?.id === s.id;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-[11px] opacity-75">
                      {cls?.name || 'Kelas'} • NIS: {s.nis}
                    </div>
                  </div>
                  {isSelected && <span className="font-bold text-amber-600">Terpilih</span>}
                </button>
              );
            })}
          </div>

          {selectedStudent && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
              Siswa terpilih: <strong>{selectedStudent.name}</strong> ({selectedStudent.nis})
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleStartPermit}
              disabled={!selectedStudent || isSubmitting}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Mencatat...' : 'Mulai Izin Keluar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
