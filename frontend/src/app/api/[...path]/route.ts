/**
 * API Proxy Route
 *
 * Forwards all /api/* requests to the FastAPI backend
 * This allows frontend and backend to be served from the same port (3118)
 *
 * Benefits:
 * - Only one port exposed to Traefik
 * - Internal Docker networking (faster, more secure)
 * - No complex Traefik routing needed
 * - Standard modern web app architecture
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:5167';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'DELETE');
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  // Skip 'api' and 'config' routes (handled separately)
  if (pathSegments.length === 1 && pathSegments[0] === 'config') {
    return NextResponse.next();
  }

  try {
    // Build target URL
    const path = pathSegments.join('/');
    const url = new URL(request.url);
    const targetUrl = `${BACKEND_URL}/${path}${url.search}`;

    console.log(`[API Proxy] ${method} ${path} -> ${targetUrl}`);

    // Forward request to backend
    const headers: HeadersInit = {};

    // Copy relevant headers
    request.headers.forEach((value, key) => {
      if (!key.startsWith('host') && !key.startsWith('connection')) {
        headers[key] = value;
      }
    });

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Add body for POST/PUT
    if (method === 'POST' || method === 'PUT') {
      const contentType = request.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } else if (contentType?.includes('multipart/form-data')) {
        fetchOptions.body = await request.formData();
      } else {
        fetchOptions.body = await request.text();
      }
    }

    // Make request to backend
    const response = await fetch(targetUrl, fetchOptions);

    // Get response body
    const contentType = response.headers.get('content-type');
    let responseBody;

    if (contentType?.includes('application/json')) {
      responseBody = await response.json();
    } else if (contentType?.includes('text')) {
      responseBody = await response.text();
    } else {
      responseBody = await response.arrayBuffer();
    }

    // Return response with same status and headers
    return new NextResponse(
      typeof responseBody === 'string' || responseBody instanceof ArrayBuffer
        ? responseBody
        : JSON.stringify(responseBody),
      {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'content-type': contentType || 'application/json',
          // Copy other relevant headers
          ...(response.headers.get('cache-control') && {
            'cache-control': response.headers.get('cache-control')!,
          }),
        },
      }
    );
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Backend request failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    );
  }
}
