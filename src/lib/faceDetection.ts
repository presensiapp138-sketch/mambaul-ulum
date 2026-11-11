import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let modelLoadingPromise: Promise<boolean> | null = null;

export async function loadFaceDetectionModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      // Load SSD MobileNet or TinyFaceDetector, landmark, and recognition models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      return true;
    } catch (err) {
      console.error('Failed to load face detection models:', err);
      // Fallback: try loading standard SSD MobileNet
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        modelsLoaded = true;
        return true;
      } catch (fallbackErr) {
        console.error('Fallback face model loading failed:', fallbackErr);
        return false;
      }
    }
  })();

  return modelLoadingPromise;
}

export interface DetectedFaceResult {
  box: { x: number; y: number; width: number; height: number };
  descriptor: Float32Array;
  score: number;
}

// Multi-face detection in video frame
export async function detectFacesInVideo(
  video: HTMLVideoElement
): Promise<DetectedFaceResult[]> {
  if (!modelsLoaded || !video || video.readyState < 2) return [];

  try {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    const detections = await faceapi
      .detectAllFaces(video, options)
      .withFaceLandmarks(true)
      .withFaceDescriptors();

    return detections.map(d => ({
      box: {
        x: d.detection.box.x,
        y: d.detection.box.y,
        width: d.detection.box.width,
        height: d.detection.box.height,
      },
      descriptor: d.descriptor,
      score: d.detection.score,
    }));
  } catch (err) {
    console.debug('Frame detection skip:', err);
    return [];
  }
}

// Single face extraction for registration / teacher attendance
export async function detectSingleFaceDescriptor(
  video: HTMLVideoElement
): Promise<number[] | null> {
  if (!modelsLoaded || !video || video.readyState < 2) return null;

  try {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    const detection = await faceapi
      .detectSingleFace(video, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection || !detection.descriptor) return null;
    return Array.from(detection.descriptor);
  } catch (err) {
    console.error('Single face detection error:', err);
    return null;
  }
}

// Calculate Euclidean distance between two 128-d face descriptors
export function computeDescriptorDistance(desc1: number[] | Float32Array, desc2: number[] | Float32Array): number {
  if (desc1.length !== desc2.length) return 1.0;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Threshold: usually 0.55 - 0.6 is standard for face-api
export const MATCH_THRESHOLD = 0.55;

export interface FaceMatch {
  personId: string;
  distance: number;
  isMatch: boolean;
}

export function findBestFaceMatch(
  queryDescriptor: Float32Array | number[],
  enrolledTemplates: Array<{ personId: string; descriptor: number[] }>
): FaceMatch | null {
  if (!enrolledTemplates || enrolledTemplates.length === 0) return null;

  let bestMatch: FaceMatch | null = null;
  let minDistance = Infinity;

  for (const t of enrolledTemplates) {
    if (!t.descriptor || t.descriptor.length === 0) continue;
    const dist = computeDescriptorDistance(queryDescriptor, t.descriptor);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = {
        personId: t.personId,
        distance: dist,
        isMatch: dist <= MATCH_THRESHOLD,
      };
    }
  }

  return bestMatch;
}

// Camera error interpreter
export function parseCameraError(err: any): { title: string; message: string } {
  if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
    return {
      title: 'Kamera Membutuhkan HTTPS',
      message: 'Browser membatasi akses kamera hanya pada koneksi aman HTTPS atau localhost.',
    };
  }

  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      title: 'Izin Kamera Ditolak',
      message: 'Harap izinkan akses kamera pada pengaturan browser untuk melanjutkan.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      title: 'Kamera Tidak Ditemukan',
      message: 'Tidak ada perangkat kamera yang terdeteksi pada perangkat ini.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      title: 'Kamera Sedang Digunakan',
      message: 'Kamera sedang dipakai oleh aplikasi lain (seperti Zoom/Meet). Tutup aplikasi tersebut dan coba lagi.',
    };
  }
  if (name === 'OverconstrainedError') {
    return {
      title: 'Resolusi Kamera Tidak Didukung',
      message: 'Spesifikasi kamera yang diminta tidak dapat dipenuhi perangkat.',
    };
  }

  return {
    title: 'Gagal Mengakses Kamera',
    message: err?.message || 'Terjadi kesalahan saat memulai video kamera. Silakan tekan Coba Lagi.',
  };
}
