# Kitchen Odyssey Deployment Guide (Azure VM + Docker Compose)

This guide explains how to deploy the **Kitchen Odyssey frontend + backend** on an Azure VM using Docker Compose.

## Overview

You will deploy two repositories:
- `kitchen-odyssey-backend` (Next.js API)
- `Kitchen_Odyssey` (React/Vite frontend served by Nginx)

Compose file used:
- `kitchen-odyssey-backend/docker-compose.prod.yml`

Domain target:
- `kitchenodyssey.eastasia.cloudapp.azure.com`

## 1. Prepare Azure VM

1. Create an Ubuntu 22.04 LTS VM (recommended).
2. Ensure your Azure VM has a Public IP.
3. Configure DNS so `kitchenodyssey.eastasia.cloudapp.azure.com` points to your VM Public IP.
4. Configure NSG inbound rules:
   1. Port `22` (SSH) from your admin IP only.
   2. Port `80` (HTTP) from Internet.
   3. Port `443` (HTTPS) from Internet (recommended for TLS setup).

## 2. Connect to VM

```bash
ssh <vm-username>@kitchenodyssey.eastasia.cloudapp.azure.com
```

## 3. Install Docker and Compose

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

Add your user to the Docker group:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Verify installation:

```bash
docker --version
docker compose version
```

## 4. Clone Repositories in Correct Layout

The compose file expects frontend repo at sibling path `../Kitchen_Odyssey` by default.

```bash
mkdir -p ~/apps
cd ~/apps
git clone <YOUR_BACKEND_GITHUB_URL> kitchen-odyssey-backend
git clone <YOUR_FRONTEND_GITHUB_URL> Kitchen_Odyssey
```

Expected structure:

```text
~/apps/
  kitchen-odyssey-backend/
  Kitchen_Odyssey/
```

## 5. Configure Backend Environment

```bash
cd ~/apps/kitchen-odyssey-backend
cp .env.docker.example .env
```

Edit `.env`:

```bash
nano .env
```

Set required values:
- `MONGODB_URI` = your MongoDB Atlas URI
- `JWT_SECRET` = long random secret
- `NODE_ENV=production`
- `HOSTNAME=0.0.0.0`
- `PORT=3000`
- `ALLOWED_ORIGINS=https://kitchenodyssey.eastasia.cloudapp.azure.com,http://kitchenodyssey.eastasia.cloudapp.azure.com`
- `IMAGE_PUBLIC_URL_BASE=https://kitchenodyssey.eastasia.cloudapp.azure.com/uploads` (recommended if using HTTPS)

Note: Backend code already force-includes both HTTP/HTTPS domain variants for this Azure DNS host in CORS allowlist.

## 6. Validate Docker Compose Configuration

From backend folder:

```bash
docker compose -f docker-compose.prod.yml config
```

This must render valid merged config without errors.

## 7. Build and Start Services

From `~/apps/kitchen-odyssey-backend`:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Check running containers:

```bash
docker compose -f docker-compose.prod.yml ps
```

## 8. Verify Deployment

1. Frontend check:

```bash
curl -I http://kitchenodyssey.eastasia.cloudapp.azure.com
```

2. Backend health check through frontend proxy path:

```bash
curl http://kitchenodyssey.eastasia.cloudapp.azure.com/api/v1/health
```

3. View logs:

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

## 9. HTTPS Setup (Recommended)

Current setup serves app on port `80`. For production, terminate TLS and serve on `443`.

Common options:
1. Host-level Nginx + Certbot (Let's Encrypt).
2. Add Caddy as reverse proxy container.
3. Use Azure Application Gateway / Front Door for TLS termination.

After HTTPS is enabled, keep:
- `ALLOWED_ORIGINS` including both `https://...` and `http://...` (for compatibility/migration).
- `IMAGE_PUBLIC_URL_BASE` as HTTPS URL.

## 10. Daily Operations

Start services:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Restart services:

```bash
docker compose -f docker-compose.prod.yml restart
```

Stop services:

```bash
docker compose -f docker-compose.prod.yml down
```

Tail all logs:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

## 11. Update Deployment (Pull New GitHub Commits)

```bash
cd ~/apps/kitchen-odyssey-backend
git pull
cd ~/apps/Kitchen_Odyssey
git pull
cd ~/apps/kitchen-odyssey-backend
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## 12. Backup and Persistence Notes

- Backend uploads are persisted in Docker volume: `backend_uploads`.
- MongoDB is externalized in Atlas (not stored on VM filesystem).

List Docker volumes:

```bash
docker volume ls
```

Inspect backend upload volume:

```bash
docker volume inspect kitchen-odyssey-backend_backend_uploads
```

## 13. Troubleshooting

### Frontend build context not found
- Ensure frontend repo is at `../Kitchen_Odyssey` relative to backend folder.
- Or override context path:

```bash
FRONTEND_CONTEXT=/absolute/path/to/Kitchen_Odyssey docker compose -f docker-compose.prod.yml up -d --build
```

### CORS errors in browser
- Verify frontend origin is exactly `http://...` or `https://...` as expected.
- Verify backend `.env` and effective runtime environment.

### Backend cannot connect to MongoDB Atlas
- Confirm Atlas network access allows VM public IP.
- Validate `MONGODB_URI` credentials and database name.

### Site not reachable externally
- Confirm NSG rules for 80/443.
- If `ufw` is enabled, allow ports 80/443.

## 14. Security Checklist

Before going live:
1. Use strong `JWT_SECRET`.
2. Restrict SSH ingress to trusted IPs only.
3. Enable HTTPS and redirect HTTP to HTTPS.
4. Keep system packages updated.
5. Consider fail2ban and basic host hardening.
6. Avoid exposing internal backend port 3000 publicly (keep proxied through frontend/reverse proxy).

---

## Quick Command Summary

```bash
# one-time setup
cd ~/apps/kitchen-odyssey-backend
cp .env.docker.example .env
nano .env

# validate + deploy
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# verify
docker compose -f docker-compose.prod.yml ps
curl http://kitchenodyssey.eastasia.cloudapp.azure.com/api/v1/health
```
