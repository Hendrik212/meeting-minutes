/**
 * Frontend Configuration
 *
 * Centralized configuration for the frontend application.
 * This ensures consistent backend URL usage across all components.
 *
 * AUTOMATIC DETECTION:
 * - Backend uses X-Forwarded-* headers to detect reverse proxy
 * - Frontend calls /client-config endpoint to get correct URLs
 * - Fallback to manual environment variables if needed
 */

// Cached values to avoid recalculating
let cachedBackendUrl: string | null = null;
let cachedWebSocketUrl: string | null = null;

// Detection state
let detectionPromise: Promise<void> | null = null;

/**
 * Automatically detect backend configuration
 *
 * This function calls the backend /client-config endpoint to detect
 * the correct URLs based on X-Forwarded-* headers. The backend knows
 * if it's behind a reverse proxy and returns appropriate URLs.
 *
 * Detection strategy:
 * 1. Try /client-config (relative path - works with reverse proxy)
 * 2. If that fails, try http://hostname:5167/client-config (direct access)
 * 3. Use returned URLs for all subsequent requests
 */
async function detectBackendConfig(): Promise<void> {
  if (typeof window === 'undefined') {
    // SSR - use defaults
    cachedBackendUrl = 'http://localhost:5167';
    cachedWebSocketUrl = 'ws://localhost:5167';
    return;
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // Try both possible endpoints
  const endpoints = [
    '/client-config',  // Relative path (works with reverse proxy)
    `${protocol}//${hostname}:5167/client-config`  // Direct access
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`[Config] Trying auto-detection at: ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        // Use a short timeout to fail fast
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const config = await response.json();

        cachedBackendUrl = config.api_url;
        cachedWebSocketUrl = config.ws_url;

        console.log('[Config] ✅ Auto-detection successful!');
        console.log(`[Config]   Backend URL: ${cachedBackendUrl}`);
        console.log(`[Config]   WebSocket URL: ${cachedWebSocketUrl}`);
        console.log(`[Config]   Behind proxy: ${config.behind_proxy}`);
        console.log(`[Config]   Detection method: ${config.detection_method}`);

        return;  // Success!
      }
    } catch (error) {
      console.warn(`[Config] Failed to detect at ${endpoint}:`, error);
      // Continue to next endpoint
    }
  }

  // Auto-detection failed - use fallback logic
  console.warn('[Config] ⚠️ Auto-detection failed, using fallback logic');

  // Fallback: check hostname
  if (hostname !== 'localhost' && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    // Domain - assume reverse proxy
    cachedBackendUrl = '/api';
    cachedWebSocketUrl = `${protocol === 'https:' ? 'wss:' : 'ws:'}//${hostname}/api/ws`;
    console.log('[Config] Fallback: Domain detected, assuming reverse proxy');
  } else {
    // Localhost or IP - direct access
    cachedBackendUrl = `${protocol}//${hostname}:5167`;
    cachedWebSocketUrl = `${protocol === 'https:' ? 'wss:' : 'ws:'}//${hostname}:5167`;
    console.log('[Config] Fallback: Local/IP detected, using port 5167');
  }
}

/**
 * Get the backend API URL
 *
 * PRODUCTION/REVERSE PROXY (Traefik, nginx, etc.):
 *   - OPTIONAL: Set NEXT_PUBLIC_API_URL environment variable to override
 *   - Example: NEXT_PUBLIC_API_URL=https://app.domain.com/api
 *   - If not set, automatic detection will be used
 *
 * DEVELOPMENT (direct access without reverse proxy):
 *   - Automatically detected
 *   - Local: http://localhost:5167
 *   - Network: http://192.168.1.100:5167
 */
export function getBackendUrl(): string {
  // Return cached value if available
  if (cachedBackendUrl) {
    return cachedBackendUrl;
  }

  // PRIORITY 1: Environment variable (manual override)
  if (process.env.NEXT_PUBLIC_API_URL) {
    cachedBackendUrl = process.env.NEXT_PUBLIC_API_URL;
    console.log('[Config] Using NEXT_PUBLIC_API_URL:', cachedBackendUrl);
    return cachedBackendUrl;
  }

  // PRIORITY 2: Auto-detection not started yet
  // Start detection in background, but return optimistic default
  if (!detectionPromise) {
    console.log('[Config] Starting auto-detection...');
    detectionPromise = detectBackendConfig();
  }

  // Return optimistic default while detection is in progress
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // Optimistic guess while detection is running
    if (hostname !== 'localhost' && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return '/api';  // Likely reverse proxy
    } else {
      return `${protocol}//${hostname}:5167`;  // Likely direct access
    }
  }

  // SSR fallback
  return 'http://localhost:5167';
}

/**
 * Get WebSocket URL for real-time updates
 *
 * PRODUCTION/REVERSE PROXY:
 *   - OPTIONAL: Set NEXT_PUBLIC_WS_URL environment variable to override
 *   - Example: NEXT_PUBLIC_WS_URL=wss://app.domain.com/api/ws
 *   - If not set, automatic detection will be used
 *
 * DEVELOPMENT:
 *   - Automatically detected based on backend configuration
 */
export function getWebSocketUrl(): string {
  // Return cached value if available
  if (cachedWebSocketUrl) {
    return cachedWebSocketUrl;
  }

  // PRIORITY 1: Environment variable (manual override)
  if (process.env.NEXT_PUBLIC_WS_URL) {
    cachedWebSocketUrl = process.env.NEXT_PUBLIC_WS_URL;
    console.log('[Config] Using NEXT_PUBLIC_WS_URL:', cachedWebSocketUrl);
    return cachedWebSocketUrl;
  }

  // PRIORITY 2: Auto-detection not started yet
  if (!detectionPromise) {
    console.log('[Config] Starting auto-detection for WebSocket...');
    detectionPromise = detectBackendConfig();
  }

  // Return optimistic default while detection is in progress
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // Optimistic guess while detection is running
    if (hostname !== 'localhost' && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${hostname}/api/ws`;  // Likely reverse proxy
    } else {
      const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${hostname}:5167`;  // Likely direct access
    }
  }

  // SSR fallback
  return 'ws://localhost:5167';
}

/**
 * Wait for auto-detection to complete
 *
 * Call this function before making critical API calls to ensure
 * the correct backend URL has been detected.
 */
export async function waitForConfig(): Promise<void> {
  if (detectionPromise) {
    await detectionPromise;
  }
}

// For backward compatibility - these call the functions
// This ensures they're evaluated at runtime, not build time
export const BACKEND_URL = getBackendUrl();
export const WEBSOCKET_URL = getWebSocketUrl();
