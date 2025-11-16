import { NextRequest, NextResponse } from 'next/server';

/**
 * Configuration API endpoint
 *
 * Returns the correct backend/WebSocket URLs by reading proxy headers.
 * This properly handles Traefik, nginx, and other reverse proxies.
 *
 * The key insight: This Next.js API route receives the SAME proxy headers
 * that were sent to the frontend, so we can detect the correct URLs without
 * needing to call the backend.
 */
export async function GET(request: NextRequest) {
  // Read proxy headers set by Traefik/nginx
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'http';
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost';

  // Determine if we're behind a reverse proxy
  const isProxied = request.headers.has('x-forwarded-host') || request.headers.has('x-forwarded-proto');

  let backendUrl: string;
  let websocketUrl: string;

  // Environment variables take highest priority
  if (process.env.NEXT_PUBLIC_API_URL) {
    backendUrl = process.env.NEXT_PUBLIC_API_URL;
  } else if (isProxied) {
    // Behind reverse proxy - backend accessible at same host via /api path
    backendUrl = `${forwardedProto}://${forwardedHost}/api`;
  } else {
    // Direct access - backend on port 5167
    backendUrl = `${forwardedProto}://${forwardedHost}:5167`;
  }

  if (process.env.NEXT_PUBLIC_WS_URL) {
    websocketUrl = process.env.NEXT_PUBLIC_WS_URL;
  } else if (isProxied) {
    const wsProto = forwardedProto === 'https' ? 'wss' : 'ws';
    websocketUrl = `${wsProto}://${forwardedHost}/api/ws`;
  } else {
    const wsProto = forwardedProto === 'https' ? 'wss' : 'ws';
    websocketUrl = `${wsProto}://${forwardedHost}:5167`;
  }

  return NextResponse.json({
    backendUrl,
    websocketUrl,
    detectedProxy: isProxied,
    headers: {
      forwardedProto,
      forwardedHost,
    }
  });
}
