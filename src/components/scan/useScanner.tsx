import { useCallback, useRef, useState } from 'react';
import { scanInventoryPhoto, type ScanItem } from '@/services/scan';
import type { LocationType } from '@/types';

/**
 * Owns the hidden file input and the scan request. Without `capture`, iOS and
 * Android both offer "Take photo" or "Photo library", so one button covers both.
 * Render `input` once; call `start()` from any button.
 */
export function useScanner(fallbackLocation: LocationType, onError: (msg: string) => void) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ScanItem[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handle = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      input.value = ''; // allow choosing the same photo again
      if (!file) return;
      setBusy(true);
      setPreview(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      try {
        setItems(await scanInventoryPhoto(file, fallbackLocation));
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Could not read the photo.');
      } finally {
        setBusy(false);
      }
    },
    [fallbackLocation, onError],
  );

  const close = useCallback(() => {
    setItems(null);
    setPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const input = (
    <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handle} data-testid="scan-input" />
  );

  return {
    input,
    busy,
    items,
    preview,
    close,
    start: () => fileInput.current?.click(),
  };
}
