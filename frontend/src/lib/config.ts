/**
 * Frontend Configuration
 *
 * Automatically detects correct backend/WebSocket URLs by reading
 * proxy headers (X-Forwarded-Host, X-Forwarded-Proto) via Next.js API route.
 *
 * Works with:
 * - Traefik reverse proxy (automatic)
 * - nginx reverse proxy (automatic)
 * - Direct access (automatic)
 * - Environment variables (optional override)
 *
 * KEY INSIGHT:
 * Uses Next.js API route (/api/config) which can read proxy headers directly.
 * No backend modifications needed - pure frontend solution!
 */

// Cached configuration
let configCache: {
  backendUrl: string;
  websocketUrl: string;
} | null = null;

let configPromise: Promise<void> | null = null;

/**
 * Fetch configuration from Next.js API route that reads proxy headers
 */
async function fetchConfig(): Promise<void> {
  if (configCache) {
    return;
  }

  try {
    const response = await fetch('/api/config');
    const data = await response.json();

    configCache = {
      backendUrl: data.backendUrl,
      websocketUrl: data.websocketUrl,
    };

    console.log('[Config] ✅ Loaded configuration:', {
      backend: configCache.backendUrl,
      websocket: configCache.websocketUrl,
      proxied: data.detectedProxy,
    });
  } catch (error) {
    console.error('[Config] Failed to fetch config, using fallback:', error);

    // Fallback to localhost for development
    configCache = {
      backendUrl: 'http://localhost:5167',
      websocketUrl: 'ws://localhost:5167',
    };
  }
}

/**
 * Get the backend API URL
 *
 * Automatically detects:
 * - Reverse proxy via X-Forwarded-Host/X-Forwarded-Proto headers
 * - Direct access (uses port 5167)
 * - Environment variables (NEXT_PUBLIC_API_URL overrides)
 */
export function getBackendUrl(): string {
  // For SSR or initial render, use environment variable or fallback
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5167';
  }

  // In browser: use cached config or return fallback while loading
  if (configCache) {
    return configCache.backendUrl;
  }

  // Start fetching if not already started
  if (!configPromise) {
    configPromise = fetchConfig();
  }

  // Return fallback while loading (will be replaced once config loads)
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5167';
}

/**
 * Get WebSocket URL for real-time updates
 */
export function getWebSocketUrl(): string {
  // For SSR or initial render
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5167';
  }

  // In browser: use cached config
  if (configCache) {
    return configCache.websocketUrl;
  }

  // Start fetching if not already started
  if (!configPromise) {
    configPromise = fetchConfig();
  }

  // Return fallback while loading
  return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5167';
}

/**
 * Ensure configuration is loaded (call this on app initialization)
 */
export async function initializeConfig(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (!configPromise) {
    configPromise = fetchConfig();
  }

  await configPromise;
}

// For backward compatibility
export const BACKEND_URL = getBackendUrl();
export const WEBSOCKET_URL = getWebSocketUrl();

// Auto-initialize on client side
if (typeof window !== 'undefined') {
  initializeConfig();
}
