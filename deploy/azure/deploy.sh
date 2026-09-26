#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly ENV_FILE="$SCRIPT_DIR/.env.azure"
readonly VM_HOST="${AZURE_VM_HOST:?Set AZURE_VM_HOST to the VM public IP or hostname}"
readonly ADMIN_USER="${AZURE_ADMIN_USER:-azureuser}"
readonly SSH_PRIVATE_KEY_PATH="${AZURE_SSH_PRIVATE_KEY_PATH:?Set AZURE_SSH_PRIVATE_KEY_PATH to your private key file}"
readonly SSH_PORT="${AZURE_SSH_PORT:-22}"
readonly RELEASE_ID="$(date -u +%Y%m%d%H%M%S)"
readonly REMOTE_ROOT="/opt/stratosphere"
readonly REMOTE_RELEASE="$REMOTE_ROOT/releases/$RELEASE_ID"
readonly REMOTE_ARCHIVE="/tmp/stratosphere-$RELEASE_ID.tar.gz"
readonly REMOTE_ENV="/tmp/stratosphere-$RELEASE_ID.env"
readonly SSH_TARGET="$ADMIN_USER@$VM_HOST"

if [[ ! -f "$SSH_PRIVATE_KEY_PATH" ]]; then
  echo "SSH private key not found: $SSH_PRIVATE_KEY_PATH" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy deploy/azure/.env.azure.example to deploy/azure/.env.azure and fill in real values." >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1
}

readonly SITE_ADDRESS="$(read_env_value SITE_ADDRESS)"
readonly PUBLIC_URL="$(read_env_value PUBLIC_URL)"
readonly POSTGRES_PASSWORD="$(read_env_value POSTGRES_PASSWORD)"
readonly JWT_SECRET="$(read_env_value JWT_SECRET)"

if [[ -z "$SITE_ADDRESS" || "$SITE_ADDRESS" == *example.com* || "$SITE_ADDRESS" == *203-0-113-10* ]]; then
  echo "Set SITE_ADDRESS in .env.azure to the real hostname." >&2
  exit 1
fi

if [[ "$PUBLIC_URL" != "https://$SITE_ADDRESS" ]]; then
  echo "PUBLIC_URL must exactly equal https://SITE_ADDRESS." >&2
  exit 1
fi

if [[ ${#POSTGRES_PASSWORD} -lt 24 || "$POSTGRES_PASSWORD" == replace-* ]]; then
  echo "POSTGRES_PASSWORD must be a generated value of at least 24 characters." >&2
  exit 1
fi

if [[ ${#JWT_SECRET} -lt 32 || "$JWT_SECRET" == replace-* ]]; then
  echo "JWT_SECRET must be a generated value of at least 32 characters." >&2
  exit 1
fi

readonly TEMP_DIR="$(mktemp -d /tmp/stratosphere-deploy.XXXXXX)"
readonly ARCHIVE="$TEMP_DIR/app.tar.gz"
cleanup() {
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT

tar \
  --exclude='.git' \
  --exclude='.agents' \
  --exclude='.codex' \
  --exclude='graphify-out' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='__pycache__' \
  --exclude='.venv' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='*/.env' \
  --exclude='*/.env.*' \
  -czf "$ARCHIVE" \
  -C "$PROJECT_ROOT" .

readonly SSH_OPTIONS=(-i "$SSH_PRIVATE_KEY_PATH" -p "$SSH_PORT" -o IdentitiesOnly=yes)
readonly SCP_OPTIONS=(-i "$SSH_PRIVATE_KEY_PATH" -P "$SSH_PORT" -o IdentitiesOnly=yes)

ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" "docker compose version >/dev/null"
scp "${SCP_OPTIONS[@]}" "$ARCHIVE" "$SSH_TARGET:$REMOTE_ARCHIVE"
scp "${SCP_OPTIONS[@]}" "$ENV_FILE" "$SSH_TARGET:$REMOTE_ENV"

ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" bash -s -- \
  "$REMOTE_RELEASE" "$REMOTE_ARCHIVE" "$REMOTE_ENV" <<'REMOTE_SCRIPT'
set -euo pipefail
readonly release_dir="$1"
readonly archive="$2"
readonly env_file="$3"

mkdir -p "$release_dir"
tar -xzf "$archive" -C "$release_dir"
install -m 600 "$env_file" "$release_dir/.env.azure"
rm -f -- "$archive" "$env_file"

cd "$release_dir"
COMPOSE_PARALLEL_LIMIT=1 docker compose \
  --project-name stratosphere \
  --env-file .env.azure \
  --file deploy/azure/docker-compose.azure.yml \
  build
docker compose \
  --project-name stratosphere \
  --env-file .env.azure \
  --file deploy/azure/docker-compose.azure.yml \
  up -d --no-build --remove-orphans

ln -sfn "$release_dir" /opt/stratosphere/current
docker compose \
  --project-name stratosphere \
  --env-file .env.azure \
  --file deploy/azure/docker-compose.azure.yml \
  ps
REMOTE_SCRIPT

curl --fail --silent --show-error --location \
  --retry 30 --retry-delay 5 --retry-all-errors \
  "https://$SITE_ADDRESS/api/health/ready"
echo
echo "Deployment healthy at https://$SITE_ADDRESS"
