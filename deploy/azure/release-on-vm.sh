#!/usr/bin/env bash
# Runs on the VM as root via Azure Run Command, started by .github/workflows/deploy.yml.
# Inputs (environment): REPO, COMMIT_SHA, IMAGE_PREFIX, GH_TOKEN.
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -euo pipefail

: "${REPO:?}" "${COMMIT_SHA:?}" "${IMAGE_PREFIX:?}" "${GH_TOKEN:?}"
# Run Command may start without HOME, which the Docker CLI expects.
export HOME="${HOME:-/root}"

readonly ROOT="/opt/stratosphere"
readonly SHARED_ENV="$ROOT/shared/.env.azure"
RELEASE="$ROOT/releases/$(date -u +%Y%m%d%H%M%S)-${COMMIT_SHA:0:12}"
OWNER="$(stat -c %U:%G "$ROOT")"
PREVIOUS="$(readlink -f "$ROOT/current" 2>/dev/null || true)"
readonly RELEASE OWNER PREVIOUS
readonly KEEP_RELEASES=5

WORK="$(mktemp -d)"
readonly WORK
trap 'rm -rf -- "$WORK"' EXIT

# Ready through Caddy, as the public sees it, but resolved to this VM so the
# check doesn't depend on hairpin routing. Retries while TLS and the app warm up.
publicly_ready() {
  local site
  site="$(sed -n 's/^SITE_ADDRESS=//p' .env.azure | tail -n 1)"
  [[ -n "$site" ]] || { echo "SITE_ADDRESS missing from .env.azure" >&2; return 1; }
  curl --fail --silent --show-error --output /dev/null \
    --resolve "$site:443:127.0.0.1" \
    --retry 12 --retry-delay 5 --retry-all-errors \
    "https://$site/api/health/ready"
}

compose() {
  docker compose \
    --project-name stratosphere \
    --env-file .env.azure \
    --file deploy/azure/docker-compose.azure.yml \
    "$@"
}

# First CI deploy: adopt the env file that deploy.sh shipped with the live release.
if [[ ! -f "$SHARED_ENV" ]]; then
  if [[ -z "$PREVIOUS" || ! -f "$PREVIOUS/.env.azure" ]]; then
    echo "Missing $SHARED_ENV and no live release to copy it from. Run deploy/azure/deploy.sh once." >&2
    exit 1
  fi
  install -D -m 600 "$PREVIOUS/.env.azure" "$SHARED_ENV"
fi

echo "Fetching deploy files for $COMMIT_SHA"
curl --fail --silent --show-error --location \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/tarball/$COMMIT_SHA" \
  | tar -xz -C "$WORK" --strip-components=1
mkdir -p "$RELEASE"
cp -a "$WORK/deploy" "$RELEASE/"

grep -v -E '^(IMAGE_TAG|IMAGE_PREFIX)=' "$SHARED_ENV" > "$RELEASE/.env.azure" || true
printf '\nIMAGE_PREFIX=%s\nIMAGE_TAG=%s\n' "$IMAGE_PREFIX" "$COMMIT_SHA" >> "$RELEASE/.env.azure"
chmod 600 "$RELEASE/.env.azure"
chown -R "$OWNER" "$RELEASE" "$ROOT/shared"

cd "$RELEASE"

echo "Pulling images"
# Throwaway Docker config so registry credentials are never left on the VM.
export DOCKER_CONFIG="$WORK/docker"
mkdir -p "$DOCKER_CONFIG"
printf '%s' "$GH_TOKEN" | docker login ghcr.io --username x-access-token --password-stdin >/dev/null
compose pull --quiet api web
docker logout ghcr.io >/dev/null
unset DOCKER_CONFIG

echo "Starting release $RELEASE"
# 'current' moves only once the release is healthy in Compose AND ready
# through Caddy; otherwise the previous release is restored below.
if compose up -d --no-build --remove-orphans --wait --wait-timeout 300 && publicly_ready; then
  ln -sfn "$RELEASE" "$ROOT/current"
  chown -h "$OWNER" "$ROOT/current"
  compose ps --format 'table {{.Service}}\t{{.Status}}'

  current="$(readlink -f "$ROOT/current")"
  ls -1dt "$ROOT"/releases/*/ | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
    old="${old%/}"
    if [[ "$old" != "$current" && "$old" != "$PREVIOUS" ]]; then
      rm -rf -- "$old"
    fi
  done
  docker image prune --all --force --filter "until=240h" >/dev/null || true
  echo "Release healthy: $COMMIT_SHA"
  exit 0
fi

echo "Release $COMMIT_SHA did not become healthy." >&2
compose ps --format 'table {{.Service}}\t{{.Status}}' >&2 || true
compose logs --tail=40 api web >&2 || true

if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
  echo "Rolling back to $PREVIOUS" >&2
  cd "$PREVIOUS"
  if compose up -d --no-build --remove-orphans --wait --wait-timeout 300; then
    echo "Rollback healthy; 'current' still points at $PREVIOUS." >&2
  else
    echo "Rollback did not become healthy either. Check the VM." >&2
  fi
fi
exit 1
