#!/usr/bin/env bash
# Nightly PostgreSQL backup to Azure Blob Storage. Runs on the VM from cron;
# installed by setup-backups.sh, which also writes the config file below.
#
# The SAS token can only create and write blobs (no read, list or delete), so
# a compromised VM cannot read or wipe earlier backups. Retention is handled
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
readonly BLOB="stratosphere-$STAMP.dump"
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

curl --fail --silent --show-error \
  --retry 3 --retry-delay 10 \
  -X PUT \
  -H "x-ms-blob-type: BlockBlob" \
  --upload-file "$DUMP" \
  "$BACKUP_CONTAINER_URL/$BLOB?$BACKUP_SAS"

echo "$(date -u +%FT%TZ) uploaded $BLOB ($(stat -c %s "$DUMP") bytes)"
