#!/usr/bin/env bash
# Nightly PostgreSQL backup to Azure Blob Storage. Runs on the VM from cron;
# installed by setup-backups.sh, which also writes the config file below.
#
# The SAS token can only create new blobs (no overwrite, read, list or
# delete), so a compromised VM cannot read, replace or wipe earlier backups.
# Retention is handled by a lifecycle rule on the storage account, not by
# this script.
#
# Optional monitoring: with BACKUP_HEALTHCHECK_URL set (a healthchecks.io
# style ping URL), each run reports success or "/fail". The service emails
# when a run fails or no run arrives on schedule, and this script also
# reports "/fail" once the token is within 30 days of expiring.
set -euo pipefail

readonly CONFIG="/opt/stratosphere/backup.env"
readonly RELEASE="/opt/stratosphere/current"
readonly LOCK_FILE="/opt/stratosphere/backup.lock"
readonly EXPIRY_WARNING_DAYS=30

# KEY=value lines, read as text and never sourced: the SAS contains "&",
# which a shell would treat as an operator.
#   BACKUP_CONTAINER_URL=https://<account>.blob.core.windows.net/<container>
#   BACKUP_SAS=<query string without the leading "?">
#   BACKUP_SAS_EXPIRES=<ISO 8601 UTC>         (optional)
#   BACKUP_HEALTHCHECK_URL=<ping URL>         (optional)
config_value() {
  sed -n "s/^$1=//p" "$CONFIG" | tail -n 1
}
BACKUP_CONTAINER_URL="$(config_value BACKUP_CONTAINER_URL)"
BACKUP_SAS="$(config_value BACKUP_SAS)"
BACKUP_SAS_EXPIRES="$(config_value BACKUP_SAS_EXPIRES)"
BACKUP_HEALTHCHECK_URL="$(config_value BACKUP_HEALTHCHECK_URL)"
readonly BACKUP_CONTAINER_URL BACKUP_SAS BACKUP_SAS_EXPIRES BACKUP_HEALTHCHECK_URL

log() {
  echo "$(date -u +%FT%TZ) $*"
}

# $1: "" for success or "/fail"; $2: message shown in the alert.
notify() {
  [[ -n "$BACKUP_HEALTHCHECK_URL" ]] || return 0
  curl --fail --silent --show-error --max-time 10 --retry 3 \
    --data-raw "$2" "$BACKUP_HEALTHCHECK_URL$1" >/dev/null || log "monitoring ping failed"
}

DUMP=""
on_exit() {
  local status=$?
  [[ -n "$DUMP" ]] && rm -f -- "$DUMP"
  if [[ "$status" -ne 0 ]]; then
    notify /fail "Stratosphere backup failed on $(hostname) (exit $status). See /opt/stratosphere/backup.log."
  fi
}
trap on_exit EXIT

if [[ -z "$BACKUP_CONTAINER_URL" || -z "$BACKUP_SAS" ]]; then
  log "backup failed: BACKUP_CONTAINER_URL or BACKUP_SAS missing in $CONFIG" >&2
  exit 1
fi

# One run at a time: a slow run must not overlap the next night's.
exec 9>"$LOCK_FILE"
if ! flock --nonblock 9; then
  log "backup skipped: another backup is still running" >&2
  exit 1
fi

readonly STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
readonly BLOB_BASE="stratosphere-$STAMP"
DUMP="$(mktemp /tmp/stratosphere-backup.XXXXXX)"

cd "$RELEASE"
# Custom format (-Fc) is compressed and restores with pg_restore. Bounded so
# a stuck database cannot hold the lock forever.
timeout 30m docker compose \
  --project-name stratosphere \
  --env-file .env.azure \
  --file deploy/azure/docker-compose.azure.yml \
  exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' </dev/null >"$DUMP"

if [[ ! -s "$DUMP" ]]; then
  log "backup failed: empty dump" >&2
  exit 1
fi

# The token can only create blobs, never overwrite them. If an upload fails
# after Azure has stored the blob, retrying under the same name would get
# 409 Conflict, so each attempt uses its own name. A rare duplicate simply
# expires with the other backups. Each attempt is time-bounded so a stalled
# transfer cannot hang the job.
uploaded=""
for attempt in 1 2 3; do
  blob="$BLOB_BASE.dump"
  [[ "$attempt" -gt 1 ]] && blob="$BLOB_BASE-retry$attempt.dump"
  if curl --fail --silent --show-error \
    --connect-timeout 20 \
    --max-time 900 \
    -X PUT \
    -H "x-ms-blob-type: BlockBlob" \
    --upload-file "$DUMP" \
    "$BACKUP_CONTAINER_URL/$blob?$BACKUP_SAS"; then
    uploaded="$blob"
    break
  fi
  sleep 10
done

if [[ -z "$uploaded" ]]; then
  log "backup failed: upload did not succeed after 3 attempts" >&2
  exit 1
fi

message="uploaded $uploaded ($(stat -c %s "$DUMP") bytes)"
log "$message"

if [[ -n "$BACKUP_SAS_EXPIRES" ]]; then
  days_left=$(( ($(date -u -d "$BACKUP_SAS_EXPIRES" +%s) - $(date -u +%s)) / 86400 ))
  if [[ "$days_left" -le "$EXPIRY_WARNING_DAYS" ]]; then
    warning="backup token expires in $days_left days ($BACKUP_SAS_EXPIRES). Re-run deploy/azure/setup-backups.sh to renew it."
    log "WARNING: $warning" >&2
    # Reported as a failure so it reaches the monitoring email, even though
    # tonight's backup itself succeeded.
    notify /fail "Backup OK, but $warning"
    exit 0
  fi
fi

notify "" "$message"
