/**
 * Platform Detection and Compatibility Layer
 *
 * Detects whether the app is running in Tauri (desktop) or web browser
 * and provides platform-specific implementations
 */

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return '__TAURI__' in window;
}

/**
 * Check if running in web browser
 */
export function isWeb(): boolean {
  return !isTauri();
}

/**
 * Get platform name
 */
export function getPlatform(): 'tauri' | 'web' {
  return isTauri() ? 'tauri' : 'web';
}

/**
 * Platform-specific invoke wrapper
 *
 * In Tauri: Uses invoke from @tauri-apps/api
 * In Web: Throws error (should use apiClient instead)
 */
export async function platformInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  } else {
    throw new Error(
      `Tauri invoke('${command}') called in web environment. Use apiClient instead.`
    );
  }
}

/**
 * Platform-specific event listener
 *
 * In Tauri: Uses listen from @tauri-apps/api
 * In Web: Uses custom event system
 */
export async function platformListen<T>(
  event: string,
  handler: (payload: T) => void
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<T>(event, (event) => {
      handler(event.payload);
    });
    return unlisten;
  } else {
    // Web-based event listener using CustomEvent
    const listener = (e: Event) => {
      const customEvent = e as CustomEvent<T>;
      handler(customEvent.detail);
    };

    window.addEventListener(event, listener);

    return () => {
      window.removeEventListener(event, listener);
    };
  }
}

/**
 * Platform-specific event emitter
 *
 * In Tauri: Uses emit from @tauri-apps/api
 * In Web: Uses CustomEvent
 */
export async function platformEmit<T>(
  event: string,
  payload: T
): Promise<void> {
  if (isTauri()) {
    const { emit } = await import('@tauri-apps/api/event');
    await emit(event, payload);
  } else {
    // Web-based event using CustomEvent
    const customEvent = new CustomEvent(event, { detail: payload });
    window.dispatchEvent(customEvent);
  }
}

/**
 * Check if feature is supported on current platform
 */
export function isFeatureSupported(feature: string): boolean {
  const features: Record<string, { tauri: boolean; web: boolean }> = {
    'system-audio': { tauri: true, web: false }, // Web can't capture all system audio
    'microphone': { tauri: true, web: true },
    'screen-audio': { tauri: true, web: true }, // Web can via getDisplayMedia
    'file-system': { tauri: true, web: false },
    'notifications': { tauri: true, web: true },
    'recording': { tauri: true, web: true },
    'transcription': { tauri: true, web: true },
    'diarization': { tauri: true, web: true },
  };

  const platform = getPlatform();
  return features[feature]?.[platform] ?? false;
}

/**
 * Get platform-specific message for unsupported features
 */
export function getUnsupportedFeatureMessage(feature: string): string {
  const messages: Record<string, string> = {
    'system-audio': 'System audio capture is only available in the desktop app. You can still record microphone audio in the browser.',
    'file-system': 'Direct file system access is only available in the desktop app.',
  };

  return messages[feature] ?? `This feature is not available on ${getPlatform()}.`;
}

/**
 * Platform information object
 */
export const platform = {
  isTauri,
  isWeb,
  getPlatform,
  invoke: platformInvoke,
  listen: platformListen,
  emit: platformEmit,
  isFeatureSupported,
  getUnsupportedFeatureMessage,
} as const;

export default platform;
