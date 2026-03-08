# Vultr deployment (single VM)

## 1) Server bootstrap (Ubuntu 24.04)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# re-login for docker group to take effect
```

## 2) Clone + env setup on VM

```bash
git clone <YOUR_REPO_URL> /opt/branchLM
cd /opt/branchLM
cp .env.production.example .env.production
# edit .env.production with real secrets + hostnames
```

## 3) DNS + firewall
- Point `preview.yourdomain.com` (and later `app.yourdomain.com`) to the VM public IP.
- Vultr firewall inbound: `22`, `80`, `443` only.

## 4) First deploy

```bash
./deploy/deploy.sh
```

## 5) GitHub Actions secrets
Set these repo secrets:
- `VULTR_SSH_PRIVATE_KEY`: private key that can SSH to VM.
- `VULTR_HOST`: VM public IP or hostname.
- `VULTR_USER`: SSH user (for example `ubuntu`).
- `VULTR_APP_DIR`: repo path on VM (for example `/opt/branchLM`).
- `DEPLOY_HOST`: public hostname for smoke checks (for example `preview.yourdomain.com`).

On each push to `main`, `.github/workflows/deploy.yml` updates and redeploys automatically.
