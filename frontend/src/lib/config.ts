/**
 * Frontend Configuration
 *
 * Centralized configuration for the frontend application.
 * This ensures consistent backend URL usage across all components.
 */

// Cached values to avoid recalculating
let cachedBackendUrl: string | null = null;
let cachedWebSocketUrl: string | null = null;

/**
 * Get the backend API URL
 *
 * PRODUCTION/REVERSE PROXY (Traefik, nginx, etc.):
 *   - REQUIRED: Set NEXT_PUBLIC_API_URL environment variable
 *   - Example: NEXT_PUBLIC_API_URL=https://app.domain.com/api
 *   - Or: NEXT_PUBLIC_API_URL=https://api.domain.com
 *
 * DEVELOPMENT (direct access without reverse proxy):
 *   - Local: http://localhost:5167 (auto-detected)
 *   - Network: http://192.168.1.100:5167 (auto-detected from hostname)
 *
 * The dynamic URL construction ONLY works for direct access.
 * If using reverse proxy, you MUST set the environment variable!
 */
export function getBackendUrl(): string {
  if (cachedBackendUrl) {
    return cachedBackendUrl;
  }

  // CRITICAL: Always prefer environment variable if set
  // This is REQUIRED for production/reverse proxy deployments
  if (process.env.NEXT_PUBLIC_API_URL) {
    cachedBackendUrl = process.env.NEXT_PUBLIC_API_URL;
    console.log('[Config] Using NEXT_PUBLIC_API_URL:', cachedBackendUrl);
    return cachedBackendUrl;
  }

  // Development fallback: construct URL from current host
  // WARNING: This only works for direct access (no reverse proxy)
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    // If accessed via domain (not localhost/IP), use relative path
    // This assumes backend is behind same reverse proxy at /api
    if (hostname !== 'localhost' && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      // Accessed via domain - assume reverse proxy with /api path
      cachedBackendUrl = '/api';
      console.warn('[Config] Domain detected, using relative /api path. Set NEXT_PUBLIC_API_URL for production!');
      return cachedBackendUrl;
    }

    // Local dev or direct IP access - use port 5167
    cachedBackendUrl = `${protocol}//${hostname}:5167`;
    console.log('[Config] Local/IP access detected, using:', cachedBackendUrl);
    return cachedBackendUrl;
  }

  // Fallback for SSR (server-side rendering)
  return 'http://localhost:5167';
}

/**
 * Get WebSocket URL for real-time updates
 *
 * PRODUCTION/REVERSE PROXY:
 *   - REQUIRED: Set NEXT_PUBLIC_WS_URL environment variable
 *   - Example: NEXT_PUBLIC_WS_URL=wss://app.domain.com/api/ws
 *   - Or: NEXT_PUBLIC_WS_URL=wss://api.domain.com/ws
 *
 * DEVELOPMENT:
 *   - Auto-detected based on hostname
 */
export function getWebSocketUrl(): string {
  if (cachedWebSocketUrl) {
    return cachedWebSocketUrl;
  }

  // CRITICAL: Always prefer environment variable if set
  if (process.env.NEXT_PUBLIC_WS_URL) {
    cachedWebSocketUrl = process.env.NEXT_PUBLIC_WS_URL;
    console.log('[Config] Using NEXT_PUBLIC_WS_URL:', cachedWebSocketUrl);
    return cachedWebSocketUrl;
  }

  // Development fallback: construct URL from current host
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;

    // If accessed via domain (not localhost/IP), use relative path
    if (hostname !== 'localhost' && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      // Accessed via domain - assume reverse proxy
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      cachedWebSocketUrl = `${wsProtocol}//${hostname}/api/ws`;
      console.warn('[Config] Domain detected for WS, using:', cachedWebSocketUrl, 'Set NEXT_PUBLIC_WS_URL for production!');
      return cachedWebSocketUrl;
    }

    // Local dev or direct IP access
    cachedWebSocketUrl = `${protocol}//${hostname}:5167`;
    console.log('[Config] Local/IP WS access detected, using:', cachedWebSocketUrl);
    return cachedWebSocketUrl;
  }

  // Fallback for SSR
  return 'ws://localhost:5167';
}

// For backward compatibility - these call the functions
// This ensures they're evaluated at runtime, not build time
export const BACKEND_URL = getBackendUrl();
export const WEBSOCKET_URL = getWebSocketUrl();
