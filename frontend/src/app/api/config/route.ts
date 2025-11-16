import { NextRequest, NextResponse } from 'next/server';

/**
 * Configuration API endpoint
 *
 * Returns the correct backend/WebSocket URLs by reading proxy headers.
 *
 * IMPORTANT: For production deployments with a domain name, you MUST set
 * NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL environment variables.
 *
 * Auto-detection ONLY works for:
 * - localhost development
 * - Direct IP access (e.g., 192.168.1.100)
 */
export async function GET(request: NextRequest) {
  // Read proxy headers set by Traefik/nginx
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'http';
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost';

  let backendUrl: string;
  let websocketUrl: string;
  let requiresEnvVar = false;

  // Priority 1: Environment variables (REQUIRED for production)
  if (process.env.NEXT_PUBLIC_API_URL) {
    backendUrl = process.env.NEXT_PUBLIC_API_URL;
  } else {
    // Check if this is localhost or IP address (development)
    const isLocalhost = forwardedHost === 'localhost' || forwardedHost.startsWith('localhost:');
    const isIpAddress = /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(forwardedHost);

    if (isLocalhost || isIpAddress) {
      // Development: Auto-detect backend on port 5167
      const hostWithoutPort = forwardedHost.split(':')[0];
      backendUrl = `${forwardedProto}://${hostWithoutPort}:5167`;
    } else {
      // Production domain: CANNOT auto-detect, MUST set environment variable
      requiresEnvVar = true;
      backendUrl = 'BACKEND_URL_NOT_CONFIGURED';
      console.error(
        '❌ NEXT_PUBLIC_API_URL environment variable is REQUIRED for production deployment!\n' +
        `   Detected host: ${forwardedHost}\n` +
        '   Set NEXT_PUBLIC_API_URL to your backend URL (e.g., https://api.yourdomain.com)'
      );
    }
  }

  if (process.env.NEXT_PUBLIC_WS_URL) {
    websocketUrl = process.env.NEXT_PUBLIC_WS_URL;
  } else {
    const isLocalhost = forwardedHost === 'localhost' || forwardedHost.startsWith('localhost:');
    const isIpAddress = /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(forwardedHost);

    if (isLocalhost || isIpAddress) {
      // Development: Auto-detect WebSocket on port 5167
      const hostWithoutPort = forwardedHost.split(':')[0];
      const wsProto = forwardedProto === 'https' ? 'wss' : 'ws';
      websocketUrl = `${wsProto}://${hostWithoutPort}:5167`;
    } else {
      // Production domain: CANNOT auto-detect
      requiresEnvVar = true;
      websocketUrl = 'WEBSOCKET_URL_NOT_CONFIGURED';
      console.error(
        '❌ NEXT_PUBLIC_WS_URL environment variable is REQUIRED for production deployment!\n' +
        `   Detected host: ${forwardedHost}\n` +
        '   Set NEXT_PUBLIC_WS_URL to your WebSocket URL (e.g., wss://api.yourdomain.com/ws)'
      );
    }
  }

  return NextResponse.json({
    backendUrl,
    websocketUrl,
    detectedProxy: request.headers.has('x-forwarded-host') || request.headers.has('x-forwarded-proto'),
    requiresEnvVar,
    error: requiresEnvVar ? 'NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL environment variables are required for production deployment' : null,
    headers: {
      forwardedProto,
      forwardedHost,
    }
  });
}
