# Deployment Configuration

This guide explains how to configure the frontend for different deployment scenarios.

## Automatic Detection (NEW!)

**The frontend now automatically detects the correct backend URL!**

The backend provides a `/client-config` endpoint that uses **X-Forwarded-*** headers to detect if it's behind a reverse proxy. The frontend calls this endpoint on startup to automatically configure the correct URLs.

**You no longer need to manually set environment variables in most cases!**

The automatic detection works for:
- ✅ Traefik reverse proxy (detects X-Forwarded-* headers)
- ✅ nginx reverse proxy (detects X-Forwarded-* headers)
- ✅ Local development (localhost)
- ✅ Network access (IP addresses)

## Environment Variables (Optional Override)

### Optional for Production/Reverse Proxy

#### `NEXT_PUBLIC_API_URL`

**Backend API endpoint for HTTP requests.**

**OPTIONAL** - only needed to override automatic detection.

Examples:
```bash
# Backend behind same domain with /api path
NEXT_PUBLIC_API_URL=https://app.domain.com/api

# Backend on subdomain
NEXT_PUBLIC_API_URL=https://api.domain.com

# Backend with custom path
NEXT_PUBLIC_API_URL=https://domain.com/backend
```

#### `NEXT_PUBLIC_WS_URL`

**WebSocket endpoint for real-time transcript updates.**

**OPTIONAL** - only needed to override automatic detection.

Examples:
```bash
# WebSocket behind same domain
NEXT_PUBLIC_WS_URL=wss://app.domain.com/api/ws

# WebSocket on subdomain
NEXT_PUBLIC_WS_URL=wss://api.domain.com/ws

# HTTP (non-SSL) - only for testing
NEXT_PUBLIC_WS_URL=ws://domain.com/api/ws
```

---

## Deployment Scenarios

### 1. Traefik Reverse Proxy (Docker Compose)

**Typical setup:**
- Frontend: `https://app.domain.com` → port 3000 (internal)
- Backend: `https://app.domain.com/api` → port 5167 (internal)

**Docker Compose example:**

```yaml
services:
  frontend:
    build: ./frontend
    environment:
      - NEXT_PUBLIC_API_URL=https://app.domain.com/api
      - NEXT_PUBLIC_WS_URL=wss://app.domain.com/api/ws
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`app.domain.com`)"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"

  backend:
    build: ./backend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`app.domain.com`) && PathPrefix(`/api`)"
      - "traefik.http.middlewares.backend-strip.stripprefix.prefixes=/api"
      - "traefik.http.routers.backend.middlewares=backend-strip"
      - "traefik.http.services.backend.loadbalancer.server.port=5167"
```

### 2. Nginx Reverse Proxy

**Nginx config:**

```nginx
# Frontend
location / {
  proxy_pass http://localhost:3000;
}

# Backend API
location /api/ {
  proxy_pass http://localhost:5167/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

**Environment variables:**

```bash
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://yourdomain.com/api/ws
```

### 3. Local Development (No Reverse Proxy)

**No environment variables needed!**

The app auto-detects the backend URL:
- Access via `http://localhost:3000` → Backend: `http://localhost:5167`
- Access via `http://192.168.1.100:3000` → Backend: `http://192.168.1.100:5167`

**Manual override (optional):**

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:5167
NEXT_PUBLIC_WS_URL=ws://localhost:5167
```

### 4. Production without Reverse Proxy

**Direct access with firewall allowing port 5167:**

Access via domain but backend on different port:

```bash
NEXT_PUBLIC_API_URL=https://app.domain.com:5167
NEXT_PUBLIC_WS_URL=wss://app.domain.com:5167
```

---

## How Auto-Detection Works

The frontend automatically detects the backend URL using **X-Forwarded-*** headers:

1. **Environment variable** (highest priority):
   - Uses `NEXT_PUBLIC_API_URL` if set
   - Overrides all auto-detection

2. **Backend header detection** (automatic):
   - Frontend calls `/client-config` endpoint on startup
   - Backend checks for X-Forwarded-Proto, X-Forwarded-Host, X-Forwarded-For headers
   - If headers present → backend is behind reverse proxy → uses `/api` path
   - If headers absent → backend has direct access → uses `hostname:5167`
   - Frontend caches the detected URLs

3. **Fallback logic** (if detection fails):
   - Domain (not localhost/IP) → assume reverse proxy → use `/api`
   - Localhost or IP → assume direct access → use `hostname:5167`

**Detection strategy:**
```
Frontend tries:
  1. /client-config (relative path - works with reverse proxy)
  2. http://hostname:5167/client-config (direct access)

Backend responds with:
  {
    "api_url": "/api" or "http://hostname:5167",
    "ws_url": "wss://host/api/ws" or "ws://hostname:5167",
    "behind_proxy": true/false,
    "detection_method": "x-forwarded-headers"
  }
```

**Check the browser console** for detection logs:
```
[Config] Trying auto-detection at: /client-config
[Config] ✅ Auto-detection successful!
[Config]   Backend URL: /api
[Config]   WebSocket URL: wss://app.domain.com/api/ws
[Config]   Behind proxy: true
[Config]   Detection method: x-forwarded-headers
```

---

## Troubleshooting

### Backend requests failing with domain access

**Symptom:** Browser shows "Failed to fetch" or "Network error"

**Cause:** Auto-detection failed or backend not accessible

**Solutions:**
1. Check browser console for `[Config]` logs to see what was detected
2. Verify backend is running and accessible
3. If behind reverse proxy, verify X-Forwarded-* headers are being set
4. Manually override with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` if needed

### WebSocket connection fails

**Symptom:** Real-time transcripts not appearing

**Cause:** Incorrect WebSocket URL or missing WS configuration in reverse proxy

**Solutions:**
1. Set `NEXT_PUBLIC_WS_URL` environment variable
2. Ensure reverse proxy supports WebSocket upgrades (see examples above)

### API calls go to wrong port

**Symptom:** Requests to `https://domain.com:5167` fail (connection refused)

**Cause:** Backend port 5167 not exposed externally (blocked by firewall/reverse proxy)

**Solution:** Set `NEXT_PUBLIC_API_URL` to the public-facing URL (through reverse proxy)

---

## Setting Environment Variables

### Docker Compose

```yaml
services:
  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=https://app.domain.com/api
      - NEXT_PUBLIC_WS_URL=wss://app.domain.com/api/ws
```

### Next.js `.env.local` (development)

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:5167
NEXT_PUBLIC_WS_URL=ws://localhost:5167
```

### Vercel/Netlify (environment panel)

Add in deployment settings:
- `NEXT_PUBLIC_API_URL` = `https://api.yourdomain.com`
- `NEXT_PUBLIC_WS_URL` = `wss://api.yourdomain.com/ws`

---

## Verification

Check that config is working correctly:

1. Open browser console
2. Look for `[Config]` or `[ApiClient]` log messages
3. Verify the detected URLs are correct

Example successful logs:
```
[Config] Using NEXT_PUBLIC_API_URL: https://app.domain.com/api
[ApiClient] Initialized with baseUrl: https://app.domain.com/api
```
