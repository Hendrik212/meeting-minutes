# Deployment Configuration

This guide explains how to configure the frontend for different deployment scenarios.

## Environment Variables

### Required for Production/Reverse Proxy

#### `NEXT_PUBLIC_API_URL`

**Backend API endpoint for HTTP requests.**

**REQUIRED** when deploying behind Traefik, nginx, or any reverse proxy.

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

**REQUIRED** when deploying behind Traefik, nginx, or any reverse proxy.

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

The frontend automatically detects the backend URL:

1. **Environment variable** (highest priority):
   - Uses `NEXT_PUBLIC_API_URL` if set

2. **Domain detection** (reverse proxy assumption):
   - If hostname is a domain (not `localhost` or IP)
   - Assumes backend at `/api` path
   - Example: `https://app.domain.com` → `https://app.domain.com/api`

3. **Local/IP detection** (direct access):
   - If hostname is `localhost` or IP address
   - Uses same host with port 5167
   - Example: `http://192.168.1.100:3000` → `http://192.168.1.100:5167`

**Check the browser console** for detection logs:
```
[Config] Using NEXT_PUBLIC_API_URL: https://app.domain.com/api
[Config] Domain detected, using relative /api path
[Config] Local/IP access detected, using: http://localhost:5167
```

---

## Troubleshooting

### Backend requests failing with domain access

**Symptom:** Browser shows "Failed to fetch" or "Network error"

**Cause:** Missing environment variables with reverse proxy

**Solution:** Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`

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
