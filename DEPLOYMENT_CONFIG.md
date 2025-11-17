# Deployment Configuration

## ✅ Automatic Same-Domain Backend Detection

**The backend is now automatically detected at the same domain via `/api` path!**

No environment variables needed for standard deployments where frontend and backend are deployed together.

---

## How It Works

### Production (Domain Name)
When you access via a domain name (e.g., `https://meetily.yourdomain.com`):
- **Frontend**: `https://meetily.yourdomain.com`
- **Backend**: `https://meetily.yourdomain.com/api` ✅ (auto-detected!)
- **WebSocket**: `wss://meetily.yourdomain.com/api/ws` ✅ (auto-detected!)

### Development (Localhost/IP)
When you access via localhost or IP address:
- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:5167` ✅ (auto-detected!)
- **WebSocket**: `ws://localhost:5167` ✅ (auto-detected!)

### Environment Variable Override (Optional)
You can still override with environment variables if needed:
```bash
NEXT_PUBLIC_API_URL=https://api.different-domain.com
NEXT_PUBLIC_WS_URL=wss://api.different-domain.com/ws
```

---

## Standard Deployment with Traefik

### Docker Compose Example

```yaml
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
    # NO ENVIRONMENT VARIABLES NEEDED! ✨
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

**That's it!** The frontend will automatically detect the backend at `https://meetily.yourdomain.com/api`.

---

## Standard Deployment with nginx

### nginx Configuration

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

**That's it!** No environment variables needed - auto-detected!

---

## Development Setup

### Running Locally

```bash
# Terminal 1: Backend
cd backend
./clean_start_backend.sh

# Terminal 2: Frontend
cd frontend
pnpm run dev
```

Access at `http://localhost:3000` - backend auto-detected at `http://localhost:5167`!

### Network Access

Run on one machine, access from another:

```bash
# On machine with IP 192.168.1.100
cd frontend && pnpm run dev
cd backend && ./clean_start_backend.sh
```

Access from any device: `http://192.168.1.100:3000`
- Backend auto-detected: `http://192.168.1.100:5167` ✅

---

## Environment Variables (Optional Override)

### When to Use Environment Variables

You only need environment variables if:
- Backend is at a different domain
- Backend is at a non-standard path
- You want to explicitly override auto-detection

### Examples

#### Backend at Different Domain
```yaml
services:
  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=https://api.different-domain.com
      - NEXT_PUBLIC_WS_URL=wss://api.different-domain.com/ws
```

#### Backend at Custom Path
```yaml
services:
  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=https://meetily.yourdomain.com/custom/path
      - NEXT_PUBLIC_WS_URL=wss://meetily.yourdomain.com/custom/path/ws
```

#### Frontend-Only Deployment
If you only deploy the frontend and users run their own backend:
```yaml
services:
  frontend:
    environment:
      # Users must run backend on same machine
      - NEXT_PUBLIC_API_URL=http://localhost:5167
      - NEXT_PUBLIC_WS_URL=ws://localhost:5167
```

---

## Debugging

### Check Auto-Detected Configuration

Visit `/api/config` endpoint:

```bash
# Production
curl https://meetily.yourdomain.com/api/config

# Development
curl http://localhost:3000/api/config
```

**Response (production with domain):**
```json
{
  "backendUrl": "https://meetily.yourdomain.com/api",
  "websocketUrl": "wss://meetily.yourdomain.com/api/ws",
  "detectedProxy": true,
  "headers": {
    "forwardedProto": "https",
    "forwardedHost": "meetily.yourdomain.com"
  }
}
```

**Response (development localhost):**
```json
{
  "backendUrl": "http://localhost:5167",
  "websocketUrl": "ws://localhost:5167",
  "detectedProxy": false,
  "headers": {
    "forwardedProto": "http",
    "forwardedHost": "localhost"
  }
}
```

### Browser Console

Open browser console (F12) and check for:

**Successful configuration:**
```javascript
[Config] ✅ Loaded configuration: {
  backend: "https://meetily.yourdomain.com/api",
  websocket: "wss://meetily.yourdomain.com/api/ws",
  proxied: true
}
[ApiClient] Initialized in Web mode
[Analytics] Web mode detected - analytics disabled
```

**Network access:**
```javascript
[Config] ✅ Loaded configuration: {
  backend: "http://192.168.1.100:5167",
  websocket: "ws://192.168.1.100:5167",
  proxied: false
}
```

### Test Backend Connection

```bash
# Test backend health
curl https://meetily.yourdomain.com/api/health

# Expected response:
{
  "status": "healthy",
  "service": "meetily-backend",
  "timestamp": 1234567890.123
}
```

---

## Common Issues

### Issue: Backend requests return 404

**Cause**: Backend not deployed or Traefik/nginx routing misconfigured

**Solutions**:
1. Verify backend is running:
   ```bash
   docker-compose ps backend
   # Should show "Up"
   ```

2. Check Traefik routes:
   ```bash
   docker-compose logs traefik | grep backend
   ```

3. Test backend directly:
   ```bash
   curl http://backend:5167/api/health
   ```

4. Verify Traefik labels are correct (see example above)

### Issue: CORS errors

**Cause**: Backend CORS not allowing frontend origin

**Solution**: Backend already allows all origins for development.
For production, update `backend/app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://meetily.yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: WebSocket connection fails

**Cause**: Reverse proxy not forwarding WebSocket upgrades

**nginx solution** (add to backend location):
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

**Traefik solution**: Works automatically, no configuration needed!

### Issue: Environment variables not working

**Cause**: Next.js requires rebuild when environment variables change

**Solution**: Rebuild the frontend container:
```bash
docker-compose up --build frontend
```

---

## Summary

### ✅ Default Setup (No Config Needed)

**Production**:
- Frontend: `https://meetily.yourdomain.com`
- Backend: `https://meetily.yourdomain.com/api` (auto-detected!)

**Development**:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5167` (auto-detected!)

### 📝 Optional Overrides

Use environment variables only when backend is at different domain or custom path.

### 🚀 Deploy and Go!

1. Set up Traefik/nginx with examples above
2. Deploy frontend and backend
3. Access your domain
4. **It just works!** ✨

No configuration. No environment variables. Just deploy!
