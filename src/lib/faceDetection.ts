import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let modelLoadingPromise: Promise<boolean> | null = null;

export function areFaceModelsLoaded(): boolean {
  return modelsLoaded;
}

export async function loadFaceDetectionModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      return true;
    } catch (err) {
      console.error('Failed to load tiny face detection models:', err);
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
        modelLoadingPromise = null;
        return false;
      }
    }
  })();

  return modelLoadingPromise;
}

export function preloadFaceModelsInBackground(): void {
  if (typeof window === 'undefined' || modelsLoaded || modelLoadingPromise) return;
  const trigger = () => {
    loadFaceDetectionModels().catch(() => {});
  };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(trigger, { timeout: 1500 });
  } else {
    setTimeout(trigger, 300);
  }
}

/**
 * Universal, fast cross-device camera stream acquisition.
 * Uses progressive constraint fallback so phones (iOS/Android), tablets,
 * laptops, and external USB webcams open immediately without OverconstrainedError.
 */
export async function acquireCameraStream(
  preferredFacingMode: 'user' | 'environment' = 'user'
): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Browser ini tidak mendukung akses kamera atau halaman tidak dibuka melalui HTTPS.');
  }

  const attempts: MediaStreamConstraints[] = [
    // Attempt 1: Ideal facing mode + light 480p resolution for instant negotiation & smooth FPS
    {
      video: {
        facingMode: { ideal: preferredFacingMode },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    },
    // Attempt 2: Only ideal facingMode without resolution constraints
    {
      video: {
        facingMode: { ideal: preferredFacingMode },
      },
      audio: false,
    },
    // Attempt 3: Universal basic video fallback for older webcams/drivers
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: any = null;

  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err: any) {
      lastError = err;
      const errName = err?.name || '';
      // If user explicitly denied permission or camera is locked by another app, don't retry
      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errName === 'NotReadableError' ||
        errName === 'TrackStartError'
      ) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Gagal membuka kamera pada perangkat ini.');
}

/**
 * Safely attach a MediaStream to an HTMLVideoElement across iOS Safari, Android Chrome, and desktop browsers.
 */
export async function attachStreamToVideo(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<void> {
  video.setAttribute('playsinline', 'true');
  video.setAttribute('autoplay', 'true');
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  video.srcObject = stream;

  await new Promise<void>((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    if (video.readyState >= 1) {
      video.play().catch(() => {});
      done();
      return;
    }

    const onLoaded = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.play().catch(() => {});
      done();
    };

    video.addEventListener('loadedmetadata', onLoaded);
    // Safety timeout so video never stalls UI if metadata event was already missed
    setTimeout(() => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.play().catch(() => {});
      done();
    }, 500);
  });
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
  if (!modelsLoaded || !video || video.readyState < 2 || video.videoWidth === 0) return [];

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
  if (!modelsLoaded) {
    await loadFaceDetectionModels();
  }
  if (!modelsLoaded || !video || video.readyState < 2 || video.videoWidth === 0) return null;

  try {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 });
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

// Extract face descriptor from an uploaded image or canvas element
export async function detectFaceDescriptorFromImage(
  image: HTMLImageElement | HTMLCanvasElement
): Promise<number[] | null> {
  if (!modelsLoaded) {
    await loadFaceDetectionModels();
  }
  if (!modelsLoaded) return null;

  try {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 });
    const detection = await faceapi
      .detectSingleFace(image, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection || !detection.descriptor) return null;
    return Array.from(detection.descriptor);
  } catch (err) {
    console.error('Image face detection error:', err);
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
      message: 'Harap izinkan akses kamera pada ikon gembok/pengaturan browser lalu tekan Coba Lagi.',
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
      message: 'Kamera sedang dipakai oleh aplikasi atau tab lain. Tutup aplikasi tersebut dan tekan Coba Lagi.',
    };
  }
  if (name === 'OverconstrainedError') {
    return {
      title: 'Resolusi Kamera Tidak Didukung',
      message: 'Coba ganti kamera depan/belakang atau tekan Coba Lagi.',
    };
  }

  return {
    title: 'Gagal Mengakses Kamera',
    message: err?.message || 'Terjadi kesalahan saat memulai video kamera. Silakan tekan Coba Lagi.',
  };
}
