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
 * In production/Docker: Use NEXT_PUBLIC_API_URL environment variable
 * In development:
 *   - If NEXT_PUBLIC_API_URL is set, use it
 *   - Otherwise, construct from window.location (works for remote access)
 *
 * This allows the web app to be accessed from any machine on the network.
 *
 * Examples:
 * - Local dev: http://localhost:5167
 * - Network access: http://192.168.1.100:5167
 * - Production: https://your-domain.com/api
 */
export function getBackendUrl(): string {
  if (cachedBackendUrl) {
    return cachedBackendUrl;
  }

  // Always prefer environment variable if set
  if (process.env.NEXT_PUBLIC_API_URL) {
    cachedBackendUrl = process.env.NEXT_PUBLIC_API_URL;
    return cachedBackendUrl;
  }

  // In browser: construct URL from current host
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Backend runs on port 5167
    cachedBackendUrl = `${protocol}//${hostname}:5167`;
    return cachedBackendUrl;
  }

  // Fallback for SSR (server-side rendering)
  return 'http://localhost:5167';
}

/**
 * Get WebSocket URL for real-time updates
 */
export function getWebSocketUrl(): string {
  if (cachedWebSocketUrl) {
    return cachedWebSocketUrl;
  }

  // Always prefer environment variable if set
  if (process.env.NEXT_PUBLIC_WS_URL) {
    cachedWebSocketUrl = process.env.NEXT_PUBLIC_WS_URL;
    return cachedWebSocketUrl;
  }

  // In browser: construct URL from current host
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    cachedWebSocketUrl = `${protocol}//${hostname}:5167`;
    return cachedWebSocketUrl;
  }

  // Fallback for SSR
  return 'ws://localhost:5167';
}

// For backward compatibility - these call the functions
// This ensures they're evaluated at runtime, not build time
export const BACKEND_URL = getBackendUrl();
export const WEBSOCKET_URL = getWebSocketUrl();
