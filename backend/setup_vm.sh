#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "  RAG Studio Secure Cloud VM Bootstrap & Deployment"
echo "  Target Origin: https://rag-pro-delta.vercel.app"
echo "=========================================================="

echo ">>> [1/6] Installing system packages..."
sudo apt-get update -y
sudo apt-get install -y curl git python3 python3-pip python3-venv ufw

echo ">>> [2/6] Registering Antigravity SSH authorization key..."
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
if ! grep -q "partha231001102097" "$HOME/.ssh/authorized_keys" 2>/dev/null; then
  echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICmGFdY6cTj0lgDWwlUhjN1Qh1S8rL9Kk0zLvQ/2FrdE partha231001102097" >> "$HOME/.ssh/authorized_keys"
  chmod 600 "$HOME/.ssh/authorized_keys"
  echo "SSH public key registered successfully."
fi

echo ">>> [3/6] Installing Ollama & pulling qwen2.5:3b..."
if ! command -v ollama &>/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
fi
sudo systemctl enable --now ollama
sleep 3
echo "Pulling qwen2.5:3b model..."
ollama pull qwen2.5:3b || ollama pull qwen2.5:0.5b

echo ">>> [4/6] Installing uv package manager & cloning backend..."
if ! command -v uv &>/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.cargo/bin:$PATH"

TARGET_DIR="$HOME/RAG-PRO"
if [ ! -d "$TARGET_DIR" ]; then
  git clone https://github.com/parthasdey2304/RAG-PRO.git "$TARGET_DIR"
else
  cd "$TARGET_DIR" && git pull origin main
fi

cd "$TARGET_DIR/backend"
"$HOME/.cargo/bin/uv" sync

echo ">>> [5/6] Creating & enabling systemd service (rag-studio.service)..."
SERVICE_USER="$USER"
SERVICE_HOME="$HOME"

sudo bash -c "cat << 'EOF' > /etc/systemd/system/rag-studio.service
[Unit]
Description=RAG Studio Secure Cloud Backend
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${SERVICE_HOME}/RAG-PRO/backend
Environment=PATH=${SERVICE_HOME}/.cargo/bin:/usr/local/bin:/usr/bin:/bin
Environment=RAG_STUDIO_TOKEN=rag_sec_7f9b2d8e4c1a5b6f3e0d8c2a9e1b4f7a
Environment=ALLOWED_ORIGINS=https://rag-pro-delta.vercel.app,http://localhost:5173,http://127.0.0.1:5173
ExecStart=${SERVICE_HOME}/.cargo/bin/uv run uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable --now rag-studio.service

echo ">>> [6/6] Verifying health & security gatekeeper..."
sleep 4
echo "Test 1: Request with valid security token..."
curl -s -f -H "x-studio-token: rag_sec_7f9b2d8e4c1a5b6f3e0d8c2a9e1b4f7a" http://127.0.0.1:8000/api/health && echo ""

echo "Test 2: Direct request without token (expecting 403 Forbidden)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/documents || true)
echo "HTTP Status without token: $STATUS"

echo "=========================================================="
echo "  DEPLOYMENT COMPLETE! RAG Studio Backend is Active."
echo "=========================================================="
