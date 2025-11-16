# Meetily Docker Deployment Guide

Complete guide for deploying Meetily as a web application using Docker with AMD GPU support.

## 🎯 Overview

This deployment transforms Meetily from a desktop-only application into a fully web-accessible platform that can be accessed from any browser. The solution includes:

- **Web-based frontend** (Next.js, accessible via browser)
- **FastAPI backend** with Whisper transcription and speaker diarization
- **AMD GPU acceleration** (ROCm) for fast AI processing
- **Traefik-ready** for easy SSL/reverse proxy integration
- **One-command deployment** via Docker Compose

## 📋 Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 22.04+ recommended)
- **Docker**: 24.0+
- **Docker Compose**: 2.20+
- **RAM**: 16GB minimum (32GB recommended for large models)
- **Disk**: 50GB+ free space (for models and recordings)
- **GPU** (optional but recommended):
  - AMD: RX 6000/7000 series or MI series (ROCm 6.0 compatible)
  - NVIDIA: RTX series (CUDA 12.1+)

### AMD GPU Setup (ROCm)

If using AMD GPU, install ROCm drivers first:

```bash
# Ubuntu 22.04
wget https://repo.radeon.com/amdgpu-install/6.0/ubuntu/jammy/amdgpu-install_6.0.60000-1_all.deb
sudo apt install ./amdgpu-install_6.0.60000-1_all.deb
sudo amdgpu-install --usecase=rocm --no-dkms

# Verify installation
rocm-smi

# Check GPU architecture
rocminfo | grep gfx

# Add user to render and video groups
sudo usermod -a -G render,video $USER
```

### Docker GPU Support

Enable Docker GPU access:

```bash
# Verify Docker can access GPU
docker run --rm --device=/dev/kfd --device=/dev/dri rocm/pytorch:rocm6.0_ubuntu22.04 rocm-smi
```

## 🚀 Quick Start

### 1. Clone and Configure

```bash
# Clone repository
git clone https://github.com/yourusername/meetily.git
cd meetily

# Create environment configuration
cp .env.example .env
nano .env
```

### 2. Configure Environment Variables

Edit `.env` with your settings:

```bash
# === Required Configuration ===

# Domain (change for production)
DOMAIN=localhost

# LLM Provider & Model
DEFAULT_PROVIDER=openai
DEFAULT_MODEL=gpt-4o
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1

# Whisper Model (base is good for testing, medium/large for production)
DEFAULT_WHISPER_MODEL=base

# Speaker Diarization (get token from https://huggingface.co/settings/tokens)
HUGGINGFACE_TOKEN=hf_your_token_here
ENABLE_DIARIZATION=true

# GPU Configuration
ENABLE_GPU=true
GPU_TYPE=rocm  # or "cuda" for NVIDIA, "cpu" for no GPU

# === Optional Configuration ===

# Log level
LOG_LEVEL=INFO

# For custom OpenAI endpoints (LM Studio, vLLM, etc.)
# OPENAI_BASE_URL=http://localhost:1234/v1
```

### 3. Build and Launch

```bash
# Build and start all services
docker compose up -d

# Watch logs
docker compose logs -f

# Check service status
docker compose ps
```

### 4. Access the Application

Once services are running:

- **Web App**: http://localhost (or your configured domain)
- **API Docs**: http://localhost/api/docs
- **Backend Direct**: http://localhost:5167
- **Frontend Direct**: http://localhost:3000

## 🏗️ Architecture

```
                    User Browser
                         ↓
┌────────────────────────────────────────────────┐
│           Traefik Reverse Proxy                │
│    (Your existing Traefik or built-in)         │
│  ├── /          → Next.js Frontend (Port 3000) │
│  └── /api       → FastAPI Backend (Port 5167)  │
└────────────────────────────────────────────────┘
         ↓                            ↓
┌──────────────────┐       ┌────────────────────────┐
│  Frontend        │       │  Backend               │
│  Container       │       │  Container             │
│                  │       │                        │
│  - Next.js App   │       │  - FastAPI API         │
│  - React UI      │       │  - Whisper STT (8178)  │
│  - Browser       │       │  - Diarization         │
│    Recording     │       │  - ROCm/GPU Accel      │
└──────────────────┘       └────────────────────────┘
         ↓                            ↓
┌────────────────────────────────────────────────┐
│             Docker Volumes                     │
│  - meetings-data  (audio recordings)           │
│  - db-data        (SQLite database)            │
│  - models-data    (Whisper/diarization models) │
│  - config-data    (application config)         │
└────────────────────────────────────────────────┘
```

## 🔧 Advanced Configuration

### Using Existing Traefik

If you already have Traefik running, the docker-compose.yml includes labels for automatic configuration:

```yaml
# Services already have these labels:
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.frontend.rule=Host(`meetily.yourdomain.com`)"
  - "traefik.http.routers.frontend.entrypoints=websecure"
  - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
```

Just set your domain in `.env`:

```bash
DOMAIN=meetily.yourdomain.com
ACME_EMAIL=you@example.com
```

### GPU Configuration

#### AMD GPU (ROCm)

The default configuration uses ROCm for AMD GPUs. If auto-detection fails, you may need to override the GPU architecture:

```bash
# Find your GPU architecture
rocminfo | grep gfx
# Example output: gfx1030

# Set in .env
HSA_OVERRIDE_GFX_VERSION=10.3.0  # For gfx1030
```

#### NVIDIA GPU (CUDA)

To use NVIDIA GPU instead:

1. Edit `.env`:
```bash
GPU_TYPE=cuda
```

2. Edit `docker-compose.yml`, comment out AMD config and uncomment NVIDIA:

```yaml
# Comment out these lines:
# devices:
#   - /dev/kfd:/dev/kfd
#   - /dev/dri:/dev/dri
# group_add:
#   - video
#   - render

# Uncomment these lines:
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```

#### CPU-Only (No GPU)

```bash
# In .env
ENABLE_GPU=false
GPU_TYPE=cpu
```

### Custom Model Paths

To avoid re-downloading models on every rebuild:

```bash
# Create local models directory
mkdir -p ./models

# Download models manually
cd models
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

# Mount in docker-compose.yml (uncomment this line):
# - ./models:/data/models:ro
```

### Performance Tuning

Adjust these environment variables for performance:

```bash
# Worker processes (CPU cores / 2)
MAX_WORKERS=4

# Transcription threads (CPU cores)
TRANSCRIPTION_THREADS=8

# Maximum upload size (in bytes, default 1GB)
MAX_UPLOAD_SIZE=2147483648
```

## 📊 Monitoring and Logs

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Service Health

```bash
# Check service status
docker compose ps

# Health check
curl http://localhost/api/health
```

### Resource Usage

```bash
# Docker stats
docker stats

# GPU usage (AMD)
watch -n 1 rocm-smi

# GPU usage (NVIDIA)
watch -n 1 nvidia-smi
```

## 🔄 Management

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose down
docker compose up -d --build
```

### Backup Data

```bash
# Create backup directory
mkdir -p backups

# Backup database
docker run --rm \
  -v meetily_db-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/db-$(date +%Y%m%d).tar.gz /data

# Backup all data volumes
docker run --rm \
  -v meetily_meetings-data:/meetings \
  -v meetily_db-data:/db \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/full-$(date +%Y%m%d).tar.gz /meetings /db
```

### Restore Data

```bash
# Restore database
docker run --rm \
  -v meetily_db-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/db-20250116.tar.gz -C /
```

### Reset Everything

```bash
# WARNING: This deletes all data!
docker compose down -v
docker compose up -d
```

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose logs

# Verify environment variables
docker compose config

# Check port conflicts
sudo netstat -tulpn | grep -E '(3000|5167|8178)'
```

### GPU Not Detected

```bash
# Verify GPU access
rocm-smi  # or nvidia-smi

# Check Docker GPU access
docker run --rm --device=/dev/kfd --device=/dev/dri rocm/pytorch:rocm6.0_ubuntu22.04 rocm-smi

# Verify user permissions
groups  # Should include 'render' and 'video'
```

### Transcription Fails

```bash
# Check Whisper server
curl http://localhost:8178

# Check backend logs
docker compose logs backend | grep -i whisper

# Verify models downloaded
docker compose exec backend ls -lah /data/models
```

### Out of Memory

```bash
# Use smaller Whisper model
DEFAULT_WHISPER_MODEL=tiny  # or base

# Reduce workers
MAX_WORKERS=2
TRANSCRIPTION_THREADS=2

# Check memory usage
free -h
docker stats
```

### Diarization Not Working

```bash
# Verify HuggingFace token
echo $HUGGINGFACE_TOKEN

# Accept model terms: https://huggingface.co/pyannote/speaker-diarization-3.1

# Check diarization logs
docker compose logs backend | grep -i diariz
```

## 🔒 Security Considerations

### Production Deployment Checklist

- [ ] Change default domain from `localhost`
- [ ] Enable HTTPS via Traefik
- [ ] Use strong, unique API keys
- [ ] Restrict CORS origins (edit `backend/app/main.py`)
- [ ] Set up firewall rules (block ports 3000, 5167, 8178)
- [ ] Enable Docker secrets for API keys (instead of .env)
- [ ] Regular security updates: `docker compose pull && docker compose up -d`
- [ ] Set up automated backups
- [ ] Monitor logs for suspicious activity
- [ ] Implement rate limiting (via Traefik middleware)

### Restricting CORS (Production)

Edit `backend/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://meetily.yourdomain.com"],  # Your domain only
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)
```

## 📚 Additional Resources

- [Whisper Models](https://github.com/ggerganov/whisper.cpp/tree/master/models)
- [ROCm Documentation](https://rocm.docs.amd.com/)
- [PyAnnote Diarization](https://github.com/pyannote/pyannote-audio)
- [Traefik Docs](https://doc.traefik.io/traefik/)
- [Docker Compose Reference](https://docs.docker.com/compose/)

## 🆘 Getting Help

If you encounter issues:

1. Check logs: `docker compose logs -f`
2. Verify configuration: `docker compose config`
3. Check [GitHub Issues](https://github.com/yourusername/meetily/issues)
4. Join our [Discord/Community](#)

## 📝 License

This project is licensed under the MIT License - see LICENSE.md for details.
