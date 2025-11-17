import { NextRequest, NextResponse } from 'next/server';

/**
 * Configuration API endpoint
 *
 * Returns the correct backend/WebSocket URLs by reading proxy headers.
 *
 * DEFAULT BEHAVIOR:
 * - localhost/IP: Backend at port 5167
 * - Domain name: Backend at same domain via /api path
 * - Environment variables: Override auto-detection
 */
export async function GET(request: NextRequest) {
  // Read proxy headers set by Traefik/nginx
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'http';
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost';

  let backendUrl: string;
  let websocketUrl: string;

  // Priority 1: Environment variables (override)
  if (process.env.NEXT_PUBLIC_API_URL) {
    backendUrl = process.env.NEXT_PUBLIC_API_URL;
  } else {
    // Check if this is localhost or IP address (development)
    const isLocalhost = forwardedHost === 'localhost' || forwardedHost.startsWith('localhost:');
    const isIpAddress = /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(forwardedHost);

    if (isLocalhost || isIpAddress) {
      // Development: Backend on port 5167
      const hostWithoutPort = forwardedHost.split(':')[0];
      backendUrl = `${forwardedProto}://${hostWithoutPort}:5167`;
    } else {
      // Production domain: Backend at same domain via /api path
      // This is the standard deployment setup where backend is proxied at /api
      backendUrl = `${forwardedProto}://${forwardedHost}/api`;
    }
  }

  if (process.env.NEXT_PUBLIC_WS_URL) {
    websocketUrl = process.env.NEXT_PUBLIC_WS_URL;
  } else {
    const isLocalhost = forwardedHost === 'localhost' || forwardedHost.startsWith('localhost:');
    const isIpAddress = /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(forwardedHost);

    if (isLocalhost || isIpAddress) {
      // Development: WebSocket on port 5167
      const hostWithoutPort = forwardedHost.split(':')[0];
      const wsProto = forwardedProto === 'https' ? 'wss' : 'ws';
      websocketUrl = `${wsProto}://${hostWithoutPort}:5167`;
    } else {
      // Production domain: WebSocket at same domain via /api path
      // Components will append the specific WebSocket endpoint (e.g., /ws/transcripts)
      const wsProto = forwardedProto === 'https' ? 'wss' : 'ws';
      websocketUrl = `${wsProto}://${forwardedHost}/api`;
    }
  }

  return NextResponse.json({
    backendUrl,
    websocketUrl,
    detectedProxy: request.headers.has('x-forwarded-host') || request.headers.has('x-forwarded-proto'),
    headers: {
      forwardedProto,
      forwardedHost,
    }
  });
}
