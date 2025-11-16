# Deployment Configuration

## ⚠️ IMPORTANT: Environment Variables Required for Production

**For production deployments (using a domain name), you MUST set these environment variables:**

```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NEXT_PUBLIC_WS_URL=wss://your-backend-url.com/ws
```

**Auto-detection ONLY works for development:**
- ✅ `http://localhost:3000` → Backend at `http://localhost:5167`
- ✅ `http://192.168.1.100:3000` → Backend at `http://192.168.1.100:5167`
- ❌ `https://meetily.yourdomain.com` → **MUST set environment variables**

---

## Why Environment Variables Are Required

The application **cannot automatically guess** where your backend is deployed. Your backend could be:
- On the same server as the frontend
- On a completely different server
- At a different domain entirely
- Not deployed at all (frontend-only)

Therefore, for production deployments, you **MUST explicitly configure** where the backend is located using environment variables.

---

## Deployment Scenarios

### 1. Production Deployment (Domain Name) - **REQUIRES ENV VARS**

You **MUST** set environment variables for any production deployment using a domain name.

#### Example: Backend at Same Domain

```yaml
# docker-compose.yml
services:
  frontend:
    build: ./frontend
    environment:
      - NEXT_PUBLIC_API_URL=https://meetily.yourdomain.com/api
      - NEXT_PUBLIC_WS_URL=wss://meetily.yourdomain.com/api/ws
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`meetily.yourdomain.com`)"

  backend:
    build: ./backend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`meetily.yourdomain.com`) && PathPrefix(`/api`)"
```

#### Example: Backend at Different Domain

```yaml
# docker-compose.yml or deployment config
services:
  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=https://api.otherdomain.com
      - NEXT_PUBLIC_WS_URL=wss://api.otherdomain.com/ws
```

#### Example: Frontend-Only Deployment (No Backend)

If you only want to deploy the frontend and users should run their own backend:

```yaml
services:
  frontend:
    environment:
      # Point to user's local backend
      - NEXT_PUBLIC_API_URL=http://localhost:5167
      - NEXT_PUBLIC_WS_URL=ws://localhost:5167
```

**Note**: This will only work if users access the frontend from the same machine running the backend.

### 2. Development (Local) - Auto-Detected ✅

No configuration needed! The app automatically detects the backend.

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

### 3. Network Access (Local Network) - Auto-Detected ✅

Access from another machine on your local network:

```bash
# On machine with IP 192.168.1.100
cd frontend && pnpm run dev
cd backend && ./clean_start_backend.sh
```

Access from any machine on the network:
- Frontend: `http://192.168.1.100:3000`
- Backend **automatically detected**: `http://192.168.1.100:5167` ✅

---

## Traefik Configuration Example

### Full Docker Compose with Traefik

```yaml
# docker-compose.yml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./acme.json:/acme.json

  frontend:
    build: ./frontend
    environment:
      # REQUIRED: Set your backend URL
      - NEXT_PUBLIC_API_URL=https://meetily.yourdomain.com/api
      - NEXT_PUBLIC_WS_URL=wss://meetily.yourdomain.com/api/ws
    labels:
      - "traefik.enable=true"
      # Frontend routes
      - "traefik.http.routers.frontend.rule=Host(`meetily.yourdomain.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"
      # HTTP to HTTPS redirect
      - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
      - "traefik.http.routers.frontend-http.rule=Host(`meetily.yourdomain.com`)"
      - "traefik.http.routers.frontend-http.entrypoints=web"
      - "traefik.http.routers.frontend-http.middlewares=redirect-to-https"

  backend:
    build: ./backend
    labels:
      - "traefik.enable=true"
      # Backend routes (at /api path)
      - "traefik.http.routers.backend.rule=Host(`meetily.yourdomain.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=5167"
      # Strip /api prefix before forwarding to backend
      - "traefik.http.middlewares.backend-stripprefix.stripprefix.prefixes=/api"
      - "traefik.http.routers.backend.middlewares=backend-stripprefix"
```

---

## nginx Configuration Example

```nginx
server {
    listen 443 ssl;
    server_name meetily.yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    # Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Backend API
    location /api {
        proxy_pass http://backend:5167;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Don't forget to set environment variables:**

```yaml
# docker-compose.yml
services:
  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=https://meetily.yourdomain.com/api
      - NEXT_PUBLIC_WS_URL=wss://meetily.yourdomain.com/api/ws
```

---

## Debugging

### Check Configuration Endpoint

Visit `/api/config` to see detected configuration:

```bash
# Development
curl http://localhost:3000/api/config

# Production
curl https://meetily.yourdomain.com/api/config
```

**Response when environment variables are set:**
```json
{
  "backendUrl": "https://meetily.yourdomain.com/api",
  "websocketUrl": "wss://meetily.yourdomain.com/api/ws",
  "detectedProxy": true,
  "requiresEnvVar": false,
  "error": null
}
```

**Response when environment variables are MISSING (production):**
```json
{
  "backendUrl": "BACKEND_URL_NOT_CONFIGURED",
  "websocketUrl": "WEBSOCKET_URL_NOT_CONFIGURED",
  "detectedProxy": true,
  "requiresEnvVar": true,
  "error": "NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL environment variables are required for production deployment"
}
```

### Browser Console

Open browser console (F12) and look for configuration logs:

**Development (working):**
```javascript
[Config] ✅ Loaded configuration: {
  backend: "http://localhost:5167",
  websocket: "ws://localhost:5167",
  proxied: false
}
```

**Production with env vars (working):**
```javascript
[Config] ✅ Loaded configuration: {
  backend: "https://meetily.yourdomain.com/api",
  websocket: "wss://meetily.yourdomain.com/api/ws",
  proxied: true
}
```

**Production WITHOUT env vars (error):**
```javascript
[Config] ❌ Loaded configuration: {
  backend: "BACKEND_URL_NOT_CONFIGURED",
  websocket: "WEBSOCKET_URL_NOT_CONFIGURED",
  proxied: true,
  error: "NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL environment variables are required..."
}
```

### Common Issues

#### Issue: "BACKEND_URL_NOT_CONFIGURED" error

**Cause**: Environment variables not set for production deployment

**Solution**: Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` in your deployment configuration

```yaml
environment:
  - NEXT_PUBLIC_API_URL=https://your-backend-url.com
  - NEXT_PUBLIC_WS_URL=wss://your-backend-url.com/ws
```

#### Issue: Backend requests failing with 502/503/504

**Cause**: Backend not deployed or not accessible at the configured URL

**Solutions**:
1. Verify backend is running: `curl https://your-backend-url.com/health`
2. Check backend logs for errors
3. Verify Traefik/nginx routing configuration
4. Check firewall rules

#### Issue: WebSocket connection fails

**Cause**: Reverse proxy not properly configured for WebSocket upgrades

**nginx solution:**
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

**Traefik solution:** (works automatically, no configuration needed)

---

## Environment Variables Reference

### `NEXT_PUBLIC_API_URL` (Required for production)

**Backend HTTP/HTTPS endpoint URL**

Examples:
```bash
# Same domain, /api path
NEXT_PUBLIC_API_URL=https://meetily.yourdomain.com/api

# Different domain
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Different subdomain
NEXT_PUBLIC_API_URL=https://backend.yourdomain.com

# Non-standard path
NEXT_PUBLIC_API_URL=https://yourdomain.com/meetily/api
```

### `NEXT_PUBLIC_WS_URL` (Required for production)

**WebSocket endpoint URL**

Examples:
```bash
# Same domain, /api/ws path
NEXT_PUBLIC_WS_URL=wss://meetily.yourdomain.com/api/ws

# Different domain
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/ws

# HTTP (non-SSL) - only for testing/development
NEXT_PUBLIC_WS_URL=ws://meetily.yourdomain.com/api/ws
```

---

## Summary

### Development (localhost/IP)
- ✅ Auto-detected
- ✅ No configuration needed
- ✅ Just run backend and frontend

### Production (domain name)
- ⚠️ **MUST set environment variables**
- ⚠️ **Cannot auto-detect backend location**
- ✅ Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`
- ✅ Deploy both frontend and backend (or configure frontend to point to external backend)

**The golden rule**: If you're using a domain name, set the environment variables!
