import { useEffect, useRef } from 'react';

// Hook to capture USB / RFID / Bluetooth keyboard-wedge hardware scanners
// Hardware scanners type characters very quickly (< 40ms per char)
// With auto-submit, presensi automatically triggers without requiring 'Enter'
export function useHardwareBarcodeScanner(
  onScan: (scannedCode: string) => void,
  enabled: boolean = true,
  options?: {
    matchDirectly?: (candidate: string) => boolean;
    autoSubmitDelayMs?: number;
  }
) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const autoSubmitDelay = options?.autoSubmitDelayMs ?? 80;

    const flushBuffer = () => {
      const code = bufferRef.current.trim();
      if (code.length >= 3) {
        onScan(code);
      }
      bufferRef.current = '';
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in standard text inputs or textareas,
      // EXCEPT when targeted at the dedicated scanner-trap-input
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        if ((target as HTMLInputElement).type !== 'password' && target.id !== 'scanner-trap-input') {
          return;
        }
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Reset buffer if more than 250ms elapsed between manual keys
      if (timeDiff > 250) {
        bufferRef.current = '';
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }

      // If scanner sends Enter or Tab, flush immediately
      if (e.key === 'Enter' || e.key === 'Tab') {
        const code = bufferRef.current.trim();
        if (code.length >= 3) {
          e.preventDefault();
          flushBuffer();
        }
        return;
      }

      // Collect single printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key;

        // 1. Instant match check: If current buffer directly matches a known student NIS or card code
        if (options?.matchDirectly && options.matchDirectly(bufferRef.current.trim())) {
          e.preventDefault();
          flushBuffer();
          return;
        }

        // 2. Auto-submit debounce: Automatically send without Enter when scanner finishes typing
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
          if (bufferRef.current.trim().length >= 3) {
            flushBuffer();
          }
        }, autoSubmitDelay);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [onScan, enabled, options]);
}
