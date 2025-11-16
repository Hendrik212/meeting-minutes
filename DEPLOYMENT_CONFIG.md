# Deployment Configuration

## Automatic Reverse Proxy Detection

The frontend **automatically detects** if it's behind a reverse proxy (Traefik, nginx, etc.) by reading standard proxy headers. **No environment variables or backend changes required!**

### How It Works

1. **Next.js API Route** (`/api/config`) reads proxy headers sent to the frontend:
   - `X-Forwarded-Host` - Original hostname (set by Traefik/nginx)
   - `X-Forwarded-Proto` - Original protocol (http/https)

2. **Automatic Detection**:
   - ✅ If proxy headers present → Backend at same host via `/api` path
   - ✅ If no proxy headers → Direct access on port `5167`

3. **Environment Variable Override** (optional):
   - `NEXT_PUBLIC_API_URL` - Backend HTTP/HTTPS endpoint
   - `NEXT_PUBLIC_WS_URL` - WebSocket endpoint

**Key Insight**: Uses Next.js API route which receives the same proxy headers as the frontend, eliminating the chicken-and-egg problem of needing to know the backend URL to ask the backend for its URL!

---

## Deployment Scenarios

### 1. Traefik Reverse Proxy (Automatic - No Config Needed!)

Traefik automatically sets `X-Forwarded-*` headers - **no environment variables required!**

```yaml
# docker-compose.yml
services:
  frontend:
    image: your-frontend:latest
    # NO ENVIRONMENT VARIABLES NEEDED! Auto-detected via proxy headers ✨
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`app.domain.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"

  backend:
    image: your-backend:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`app.domain.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=5167"
```

**What happens:**
1. User accesses: `https://app.domain.com`
2. Traefik sets headers: `X-Forwarded-Host: app.domain.com`, `X-Forwarded-Proto: https`
3. Frontend `/api/config` reads headers from the request
4. Backend URL automatically detected: `https://app.domain.com/api` ✅
5. WebSocket automatically detected: `wss://app.domain.com/api/ws` ✅

### 2. nginx Reverse Proxy

Ensure nginx sets the forwarded headers:

```nginx
server {
    listen 443 ssl;
    server_name app.domain.com;

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;           # Required
        proxy_set_header X-Forwarded-Proto $scheme;        # Required
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api {
        proxy_pass http://backend:5167;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;           # Required
        proxy_set_header X-Forwarded-Proto $scheme;        # Required

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**No environment variables needed** - auto-detected from headers! ✨

### 3. Direct Access (Development)

No proxy, no problem - just run the services:

```bash
# Backend
cd backend
./clean_start_backend.sh

# Frontend
cd frontend
pnpm run dev
```

Access at:
- Frontend: `http://localhost:3000`
- Backend **automatically detected**: `http://localhost:5167` ✅

### 4. Network Access (No Proxy)

Access from another machine on the network:

- Frontend: `http://192.168.1.100:3000`
- Backend **automatically detected**: `http://192.168.1.100:5167` ✅

**How?** No `X-Forwarded-*` headers present, so the app knows it's direct access and uses port 5167.

---

## Environment Variable Override (Optional)

If automatic detection doesn't work or you need custom URLs, set environment variables:

```bash
# Production with reverse proxy
NEXT_PUBLIC_API_URL=https://app.domain.com/api
NEXT_PUBLIC_WS_URL=wss://app.domain.com/api/ws

# Custom subdomain
NEXT_PUBLIC_API_URL=https://api.domain.com
NEXT_PUBLIC_WS_URL=wss://api.domain.com/ws

# Non-standard path
NEXT_PUBLIC_API_URL=https://domain.com/backend/api
NEXT_PUBLIC_WS_URL=wss://domain.com/backend/api/ws
```

**Docker Compose example:**

```yaml
services:
  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=https://app.domain.com/api
      - NEXT_PUBLIC_WS_URL=wss://app.domain.com/api/ws
```

**Next.js `.env.local` (development):**

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:5167
NEXT_PUBLIC_WS_URL=ws://localhost:5167
```

---

## Debugging

### Check Detected Configuration

**Browser Console Logs:**

```javascript
[Config] ✅ Loaded configuration: {
  backend: "https://app.domain.com/api",
  websocket: "wss://app.domain.com/api/ws",
  proxied: true
}
```

**Direct API Call:**

Visit `/api/config` endpoint to see what was detected:

```bash
curl https://app.domain.com/api/config
```

Response:
```json
{
  "backendUrl": "https://app.domain.com/api",
  "websocketUrl": "wss://app.domain.com/api/ws",
  "detectedProxy": true,
  "headers": {
    "forwardedProto": "https",
    "forwardedHost": "app.domain.com"
  }
}
```

### Verify Proxy Headers

Check that your reverse proxy is setting the headers:

```bash
# Check frontend request headers
curl -I https://app.domain.com/api/config

# Should include:
# X-Forwarded-Host: app.domain.com
# X-Forwarded-Proto: https
```

---

## Troubleshooting

### Issue: Backend requests failing

**Symptom:** Browser shows "Failed to fetch" or "Network error"

**Debug steps:**

1. Check `/api/config` endpoint:
   ```bash
   curl https://app.domain.com/api/config
   ```

2. Verify proxy headers are present:
   ```bash
   curl -I https://app.domain.com/api/config | grep -i "x-forwarded"
   ```

3. Check browser console for config logs

4. If headers are missing, add them to your reverse proxy config (see examples above)

5. If auto-detection fails, set environment variables manually

### Issue: WebSocket connection fails

**Symptom:** Real-time transcripts not appearing

**Solutions:**

1. Ensure reverse proxy supports WebSocket upgrades:
   ```nginx
   # nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

   ```yaml
   # Traefik (automatic WebSocket support - no config needed)
   ```

2. Check WebSocket URL in browser console:
   ```javascript
   [Config] ✅ Loaded configuration: {
     websocket: "wss://app.domain.com/api/ws"  // Should use wss:// for HTTPS
   }
   ```

3. Verify backend WebSocket endpoint is accessible:
   ```bash
   # Install websocat: https://github.com/vi/websocat
   websocat wss://app.domain.com/api/ws
   ```

### Issue: Wrong URLs detected

**Symptom:** URLs don't match your setup

**Solution:** Set environment variables explicitly:

```yaml
services:
  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=https://your-actual-backend-url/api
      - NEXT_PUBLIC_WS_URL=wss://your-actual-backend-url/api/ws
```

Environment variables **always override** automatic detection.

### Issue: CORS errors

**Symptom:** "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solution:** Configure backend CORS to allow your frontend domain:

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.domain.com",  # Your frontend domain
        "http://localhost:3000",   # Development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Technical Details

### How Proxy Header Detection Works

1. **Frontend makes request** to `/api/config` (Next.js API route)
2. **Next.js API route** reads incoming request headers:
   ```typescript
   const forwardedProto = request.headers.get('x-forwarded-proto');
   const forwardedHost = request.headers.get('x-forwarded-host');
   ```
3. **Determines if proxied**:
   ```typescript
   const isProxied = request.headers.has('x-forwarded-host');
   ```
4. **Constructs URLs**:
   - Proxied: `${forwardedProto}://${forwardedHost}/api`
   - Direct: `${forwardedProto}://${forwardedHost}:5167`

5. **Frontend caches** the configuration for all subsequent requests

### Why This Works

- **Reverse proxies** (Traefik, nginx, etc.) automatically set `X-Forwarded-*` headers
- **Next.js API routes** run on the frontend server and receive the same headers
- **No chicken-and-egg problem** - we don't need to call the backend to know where the backend is!
- **Pure frontend solution** - no backend modifications required

---

## Summary

✅ **Traefik**: Auto-detected, no config needed
✅ **nginx**: Auto-detected with proper headers
✅ **Direct access**: Auto-detected
✅ **Network access**: Auto-detected
✅ **Environment variables**: Optional override
✅ **No backend changes**: Pure frontend solution

**Just deploy and it works!** 🚀
