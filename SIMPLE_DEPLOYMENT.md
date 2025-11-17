# Simple Deployment Guide

## Architecture Overview

**Modern single-port architecture:**
- Frontend (Next.js) serves on port **3118**
- Backend (FastAPI) runs internally, accessed via Next.js proxy
- Only **one port exposed** to Traefik/reverse proxy
- All `/api/*` requests are automatically proxied to backend

```
Browser → Traefik → Port 3118 (Frontend)
                         ↓
                    Next.js routes /api/* → Backend (internal)
```

## Deployment Steps

### 1. Start the containers

```bash
cd /path/to/meeting-minutes
docker-compose up -d
```

### 2. Configure your Traefik (external machine)

**Your Traefik only needs to route to port 3118:**

```yaml
http:
  routers:
    meetily:
      rule: "Host(`meetily.hendrikgroove.de`)"
      entryPoints:
        - https
      service: meetily-service
      tls:
        certResolver: porkbun
      middlewares:
        - secured
        - local-access-only

  services:
    meetily-service:
      loadBalancer:
        servers:
          - url: "http://192.168.1.131:3118"
```

**That's it!** No need for:
- Separate backend routing
- stripPrefix middleware
- Multiple priorities
- Multiple services

### 3. Test

```bash
# Test frontend
curl https://meetily.hendrikgroove.de

# Test backend API (via Next.js proxy)
curl https://meetily.hendrikgroove.de/api/health
# Should return: {"status":"healthy","service":"meetily-backend",...}
```

## How It Works

### Next.js API Proxy

All requests to `/api/*` are automatically proxied:

1. Browser requests: `https://meetily.hendrikgroove.de/api/get-model-config`
2. Traefik forwards to: `http://192.168.1.131:3118/api/get-model-config`
3. Next.js receives request at `/api/get-model-config`
4. Next.js proxy forwards to: `http://backend:5167/get-model-config` (internal Docker network)
5. Backend responds to Next.js
6. Next.js returns response to browser

### Internal Communication

- Frontend and backend are on the same Docker network (`meetily-network`)
- Frontend can reach backend via hostname: `http://backend:5167`
- Backend is NOT exposed to host machine (more secure)
- All external access goes through Next.js proxy

## Debugging

### Check containers are running
```bash
docker-compose ps
```

Both should be "Up":
- `meetily-frontend`
- `meetily-backend`

### Check logs
```bash
# Frontend logs (includes proxy logs)
docker-compose logs -f frontend

# Backend logs
docker-compose logs -f backend
```

### Test internal communication
```bash
# Enter frontend container
docker exec -it meetily-frontend sh

# Test backend from inside frontend
curl http://backend:5167/health
# Should return: {"status":"healthy",...}
```

### Enable direct backend access (for debugging only)

Uncomment in `docker-compose.yml`:
```yaml
backend:
  ports:
    - "5167:5167"  # Uncomment this
```

Then restart:
```bash
docker-compose down && docker-compose up -d
```

Now you can test backend directly:
```bash
curl http://192.168.1.131:5167/health
```

**Remember to comment it out again for production!**

## Common Issues

### API requests return 502
- Backend container is not running
- Check: `docker-compose logs backend`

### Frontend loads but API calls fail
- Check Next.js proxy logs: `docker-compose logs frontend | grep Proxy`
- Verify internal networking: `docker network inspect meetily-network`

### CORS errors
- Shouldn't happen with this setup (same origin)
- If you see them, something is misconfigured

## Advantages of This Setup

✅ **Simpler**: Only one port to manage
✅ **More secure**: Backend not directly exposed
✅ **Faster**: Internal Docker networking
✅ **Standard**: Modern web app architecture
✅ **Easier debugging**: All logs in one place
✅ **No CORS issues**: Same-origin requests

## Migration from Old Setup

If you had separate routing before:

1. **Remove** backend routing from Traefik config
2. **Keep** only frontend routing to port 3118
3. **Restart** containers: `docker-compose down && docker-compose up -d`
4. **Test**: `curl https://yourdomain.com/api/health`

Done! 🎉
