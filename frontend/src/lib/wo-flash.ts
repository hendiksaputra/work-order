const WO_FLASH_KEY = 'wo-flash';

export type WoFlash = { variant: 'success' | 'error'; message: string };

export function stashWorkOrderFlash(flash: WoFlash): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(WO_FLASH_KEY, JSON.stringify(flash));
}

export function consumeWorkOrderFlash(): WoFlash | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(WO_FLASH_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(WO_FLASH_KEY);
  try {
    return JSON.parse(raw) as WoFlash;
  } catch {
    return null;
  }
}
