# Deployment Troubleshooting Guide

## 🚨 Common Issue: API 404 Errors with External Traefik

If you're seeing errors like:
```
GET https://yourdomain.com/api/get-model-config 404 (Not Found)
```

This means the backend requests are not reaching your FastAPI backend. Here's how to fix it:

### Root Causes & Solutions

#### 1. ⚠️  DOMAIN Environment Variable Not Set

**Problem**: The Traefik routing rules use `${DOMAIN}` to match incoming requests. If not set or set incorrectly, requests won't route to the backend.

**Solution**:
```bash
# Create .env file if it doesn't exist
cp .env.example .env

# Edit .env and set DOMAIN to match your actual domain
nano .env
```

Set:
```bash
DOMAIN=meetily.hendrikgroove.de  # Replace with YOUR domain
```

**Critical**: DOMAIN must EXACTLY match what users type in their browser!

#### 2. 🌐 External Traefik Network Configuration

**Problem**: Your containers are on `meetily-network` but your external Traefik is on a different network (e.g., `traefik`). They can't communicate.

**Solution A - Connect Traefik to Meetily Network** (Recommended):
```bash
# Find your Traefik container name
docker ps | grep traefik

# Connect Traefik to meetily network
docker network connect meetily-network <traefik-container-name>

# Restart your meetily containers
docker-compose down && docker-compose up -d
```

**Solution B - Use External Network**:

1. Edit `docker-compose.yml` networks section:
```yaml
networks:
  meetily-network:
    external: true
    name: traefik  # Your Traefik network name
    # driver: bridge  # Comment this out
```

2. Restart:
```bash
docker-compose down
docker-compose up -d
```

#### 3. 📋 Verify Traefik Configuration

Ensure your external Traefik has:
- Docker provider enabled
- Access to docker socket (`/var/run/docker.sock`)
- Correct entrypoints configured (`websecure` for HTTPS)

Check Traefik dashboard (usually at `http://localhost:8080`) to see if:
- Both `meetily-frontend` and `meetily-backend` routers are detected
- Routers show as "Ready"
- Middleware `backend-stripprefix` is applied to backend router

### Verification Steps

1. **Check containers are running**:
```bash
docker-compose ps
```
Both `meetily-frontend` and `meetily-backend` should be "Up".

2. **Check networks**:
```bash
# List networks
docker network ls

# Inspect meetily-network
docker network inspect meetily-network

# Verify both containers AND Traefik are on same network
```

3. **Check Traefik labels**:
```bash
docker inspect meetily-backend | grep traefik
```
Should show labels including your DOMAIN.

4. **Test backend directly** (bypassing Traefik):
```bash
# From host machine
curl http://localhost:5167/health

# Should return:
# {"status":"healthy","service":"meetily-backend","timestamp":...}
```

5. **Test through Traefik**:
```bash
curl https://yourdomain.com/api/health

# Should return same health check response
```

### Quick Fix Checklist

- [ ] `.env` file exists and has correct `DOMAIN=yourdomain.com`
- [ ] Traefik and meetily containers are on same Docker network
- [ ] Backend responds to `curl http://localhost:5167/health`
- [ ] Traefik shows both routers in dashboard
- [ ] Restart containers: `docker-compose down && docker-compose up -d`

### Still Not Working?

**Check backend logs**:
```bash
docker-compose logs backend
```

**Check Traefik logs**:
```bash
docker logs <traefik-container-name>
```

**Check frontend is detecting correct backend URL**:
1. Open browser console (F12)
2. Look for: `[Config] ✅ Loaded configuration: {backend: ...}`
3. Backend URL should match your domain + `/api`

---

## 📚 Additional Resources

- [Docker Networks Documentation](https://docs.docker.com/network/)
- [Traefik Docker Provider](https://doc.traefik.io/traefik/providers/docker/)
- [Traefik Routing Rules](https://doc.traefik.io/traefik/routing/routers/)

## 💡 Pro Tips

1. **Use Traefik Dashboard**: Enable it to visualize routing
2. **Check Traefik Access Logs**: See what requests are hitting Traefik
3. **Test incrementally**: Verify each layer (backend → Traefik → frontend)
4. **Use docker-compose logs**: Real-time logging helps debug routing issues

## 🐛 Report Issues

If you've followed all steps and still have issues, please report at:
https://github.com/Zackriya-Solutions/meeting-minutes/issues

Include:
- Your docker-compose.yml (remove sensitive data)
- .env file (remove API keys)
- Output of `docker-compose logs backend`
- Output of `docker network inspect meetily-network`
- Browser console errors
