#!/usr/bin/env bash
# Instala dependências de uma VPS Ubuntu limpa e clona o repo de infra.
# Uso: curl -fsSL .../infra/bootstrap.sh | bash
set -euo pipefail

echo "▶ Atualizando apt"
apt-get update -y
apt-get install -y curl ca-certificates gnupg lsb-release git ufw jq

echo "▶ Instalando Docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

echo "▶ Instalando Node 20 + PM2"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "▶ Firewall"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
yes | ufw enable || true

echo "▶ Clonando repo de infra em /opt/mvbroker-infra"
if [ ! -d /opt/mvbroker-infra ]; then
  git clone https://github.com/rafaelmendes94/mvbroker-2309b0aa.git /opt/mvbroker-infra
fi

echo "▶ Criando rede docker compartilhada"
docker network inspect web >/dev/null 2>&1 || docker network create web

echo ""
echo "✅ Bootstrap concluído."
echo "   Próximo passo: cd /opt/mvbroker-infra/infra && cp .env.example .env && nano .env"
