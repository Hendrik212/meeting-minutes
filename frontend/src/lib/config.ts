/**
 * Frontend Configuration
 *
 * Centralized configuration for the frontend application.
 * This ensures consistent backend URL usage across all components.
 */

/**
 * Backend API URL
 *
 * CRITICAL: When running in web browser, we need the FULL URL including port.
 * - Development: http://localhost:5167
 * - Production: Set via NEXT_PUBLIC_API_URL environment variable
 *
 * DO NOT use relative URLs like '/api' - they will fail in browser!
 */
export const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5167';

/**
 * WebSocket URL for real-time transcript updates
 */
export const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5167';
