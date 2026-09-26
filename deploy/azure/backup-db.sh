#!/usr/bin/env bash
# Nightly PostgreSQL backup to Azure Blob Storage. Runs on the VM from cron;
# installed by setup-backups.sh, which also writes the config file below.
#
# The SAS token can only create new blobs (no overwrite, read, list or
# delete), so a compromised VM cannot read, replace or wipe earlier backups. Retention is handled
# by a lifecycle rule on the storage account, not by this script.
set -euo pipefail

readonly CONFIG="/opt/stratosphere/backup.env"
readonly RELEASE="/opt/stratosphere/current"

# BACKUP_CONTAINER_URL=https://<account>.blob.core.windows.net/<container>
# BACKUP_SAS=<query string without the leading "?">
# Read as plain KEY=value text, never sourced: the SAS contains "&", which a
# shell would treat as an operator.
config_value() {
  sed -n "s/^$1=//p" "$CONFIG" | tail -n 1
}
BACKUP_CONTAINER_URL="$(config_value BACKUP_CONTAINER_URL)"
BACKUP_SAS="$(config_value BACKUP_SAS)"
readonly BACKUP_CONTAINER_URL BACKUP_SAS
if [[ -z "$BACKUP_CONTAINER_URL" || -z "$BACKUP_SAS" ]]; then
  echo "$(date -u +%FT%TZ) backup failed: BACKUP_CONTAINER_URL or BACKUP_SAS missing in $CONFIG" >&2
  exit 1
fi

readonly STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
readonly BLOB_BASE="stratosphere-$STAMP"
DUMP="$(mktemp /tmp/stratosphere-backup.XXXXXX)"
readonly DUMP
trap 'rm -f -- "$DUMP"' EXIT

cd "$RELEASE"
# Custom format (-Fc) is compressed and restores with pg_restore.
docker compose \
  --project-name stratosphere \
  --env-file .env.azure \
  --file deploy/azure/docker-compose.azure.yml \
  exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$DUMP"

if [[ ! -s "$DUMP" ]]; then
  echo "$(date -u +%FT%TZ) backup failed: empty dump" >&2
  exit 1
fi

# The token can only create blobs, never overwrite them. If an upload fails
# after Azure has stored the blob, retrying under the same name would get
# 409 Conflict, so each attempt uses its own name. A rare duplicate simply
# expires with the other backups.
for attempt in 1 2 3; do
  blob="$BLOB_BASE.dump"
  [[ "$attempt" -gt 1 ]] && blob="$BLOB_BASE-retry$attempt.dump"
  if curl --fail --silent --show-error \
    -X PUT \
    -H "x-ms-blob-type: BlockBlob" \
    --upload-file "$DUMP" \
    "$BACKUP_CONTAINER_URL/$blob?$BACKUP_SAS"; then
    echo "$(date -u +%FT%TZ) uploaded $blob ($(stat -c %s "$DUMP") bytes)"
    exit 0
  fi
  sleep 10
done

echo "$(date -u +%FT%TZ) backup failed: upload did not succeed after 3 attempts" >&2
exit 1
