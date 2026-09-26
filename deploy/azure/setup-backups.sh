#!/usr/bin/env bash
# One-time setup for nightly database backups (run locally after the first
# deploy). Safe to re-run: it reuses the storage account and replaces the
# SAS token, config file and cron entry.
#
# Creates a private storage account and container, a lifecycle rule that
# deletes backups after BACKUP_RETENTION_DAYS, and a create-only SAS token
# under a revocable stored access policy (valid BACKUP_TOKEN_VALID_DAYS).
# Then installs backup-db.sh and a nightly cron job on the VM and proves the
# new token with one real backup before revoking any older token.
#
# Optional: BACKUP_HEALTHCHECK_URL (e.g. a free healthchecks.io check) makes
# each backup report success or failure, so a failed or missed backup, or a
# token about to expire, reaches you by email.
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-stratosphere-demo-rg}"
readonly LOCATION="${AZURE_LOCATION:-southindia}"
readonly VM_HOST="${AZURE_VM_HOST:?Set AZURE_VM_HOST to the VM public IP or hostname}"
readonly ADMIN_USER="${AZURE_ADMIN_USER:-azureuser}"
readonly SSH_PRIVATE_KEY_PATH="${AZURE_SSH_PRIVATE_KEY_PATH:?Set AZURE_SSH_PRIVATE_KEY_PATH to your private key file}"
readonly CONTAINER="db-backups"
readonly RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
readonly TOKEN_VALID_DAYS="${BACKUP_TOKEN_VALID_DAYS:-365}"
# 20:17 UTC is 01:47 in India: quiet hours, off the top of the hour.
readonly CRON_SCHEDULE="${BACKUP_CRON_SCHEDULE:-17 20 * * *}"

# Storage account names are global, 3-24 lowercase letters and digits. Derive
# a stable one from the subscription so re-runs find the same account.
SUBSCRIPTION_ID="$(az account show --query id --output tsv)"
readonly SUBSCRIPTION_ID
readonly STORAGE_ACCOUNT="${AZURE_BACKUP_STORAGE_ACCOUNT:-stratobk$(printf '%s' "$SUBSCRIPTION_ID" | sha256sum | cut -c1-12)}"

readonly SSH_OPTIONS=(-i "$SSH_PRIVATE_KEY_PATH" -o IdentitiesOnly=yes)
readonly SSH_TARGET="$ADMIN_USER@$VM_HOST"

az storage account create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_ACCOUNT" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --access-tier Hot \
  --https-only true \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false \
  --tags project=stratosphere purpose=db-backups \
  --output none

ACCOUNT_KEY="$(az storage account keys list \
  --resource-group "$RESOURCE_GROUP" \
  --account-name "$STORAGE_ACCOUNT" \
  --query "[0].value" --output tsv)"

az storage container create \
  --name "$CONTAINER" \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$ACCOUNT_KEY" \
  --public-access off \
  --output none

POLICY_FILE="$(mktemp)"
# Set once the new access policy exists; cleared once its token has passed
# the test backup. Any failure in between deletes it again, so failed
# rotations cannot pile up (a container allows only 5 stored policies).
NEW_POLICY=""
on_exit() {
  local status=$?
  rm -f -- "$POLICY_FILE"
  if [[ -n "$NEW_POLICY" && -n "${ACCOUNT_KEY:-}" ]]; then
    az storage container policy delete \
      --container-name "$CONTAINER" \
      --name "$NEW_POLICY" \
      --account-name "$STORAGE_ACCOUNT" \
      --account-key "$ACCOUNT_KEY" \
      --output none || echo "Could not remove unused policy $NEW_POLICY; delete it by hand." >&2
    echo "Rotation failed: removed the unused policy $NEW_POLICY. The previous token is still in place." >&2
  fi
  return "$status"
}
trap on_exit EXIT
cat >"$POLICY_FILE" <<EOF
{
  "rules": [
    {
      "enabled": true,
      "name": "expire-db-backups",
      "type": "Lifecycle",
      "definition": {
        "actions": { "baseBlob": { "delete": { "daysAfterModificationGreaterThan": $RETENTION_DAYS } } },
        "filters": { "blobTypes": ["blockBlob"], "prefixMatch": ["$CONTAINER/"] }
      }
    }
  ]
}
EOF
az storage account management-policy create \
  --resource-group "$RESOURCE_GROUP" \
  --account-name "$STORAGE_ACCOUNT" \
  --policy "@$POLICY_FILE" \
  --output none

# The VM's token hangs off a stored access policy on the container, so it
# can be revoked: deleting the policy invalidates every token issued under
# it (an ad hoc SAS stays valid until expiry unless the account key itself
# is rotated). Create-only ("c"): the VM can add new backups but can never
# overwrite, read, list or delete existing ones.
#
# Order matters: the new token is created, installed and proven with a real
# backup before any old policy is revoked, so a failure part-way leaves the
# previous token working.
readonly POLICY_PREFIX="vm-backup-writer-"
POLICY_NAME="${POLICY_PREFIX}$(date -u +%Y%m%d%H%M%S)"
readonly POLICY_NAME
SAS_EXPIRES="$(date -u -d "+$TOKEN_VALID_DAYS days" +%Y-%m-%dT%H:%MZ)"
readonly SAS_EXPIRES

az storage container policy create \
  --container-name "$CONTAINER" \
  --name "$POLICY_NAME" \
  --permissions c \
  --expiry "$SAS_EXPIRES" \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$ACCOUNT_KEY" \
  --output none
NEW_POLICY="$POLICY_NAME"
SAS="$(az storage container generate-sas \
  --name "$CONTAINER" \
  --policy-name "$POLICY_NAME" \
  --https-only \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$ACCOUNT_KEY" \
  --output tsv)"

readonly CONTAINER_URL="https://$STORAGE_ACCOUNT.blob.core.windows.net/$CONTAINER"

ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" "mkdir -p /opt/stratosphere/bin"
scp "${SSH_OPTIONS[@]}" "$SCRIPT_DIR/backup-db.sh" "$SSH_TARGET:/opt/stratosphere/bin/backup-db.sh.new"

# Config goes over stdin so the SAS never appears in a process list. An
# existing BACKUP_HEALTHCHECK_URL on the VM is kept unless a new one is given.
{
  printf 'BACKUP_CONTAINER_URL=%s\n' "$CONTAINER_URL"
  printf 'BACKUP_SAS=%s\n' "$SAS"
  printf 'BACKUP_SAS_EXPIRES=%s\n' "$SAS_EXPIRES"
  if [[ -n "${BACKUP_HEALTHCHECK_URL:-}" ]]; then
    printf 'BACKUP_HEALTHCHECK_URL=%s\n' "$BACKUP_HEALTHCHECK_URL"
  fi
} | ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" "umask 077 && cat > /opt/stratosphere/backup.env.new"

# ssh joins its arguments into one remote command line, so quote the
# schedule for the remote shell or its spaces and "*" get split and expanded.
ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" "bash -s -- $(printf '%q' "$CRON_SCHEDULE")" <<'REMOTE'
set -euo pipefail
readonly dir=/opt/stratosphere
umask 077
if ! grep -q '^BACKUP_HEALTHCHECK_URL=' "$dir/backup.env.new" && [[ -f "$dir/backup.env" ]]; then
  grep '^BACKUP_HEALTHCHECK_URL=' "$dir/backup.env" >>"$dir/backup.env.new" || true
fi
chmod 700 "$dir/bin/backup-db.sh.new"

# Swap in the new script and config, keeping the old ones until the new
# token has produced a real backup.
[[ -f "$dir/backup.env" ]] && cp -p "$dir/backup.env" "$dir/backup.env.prev"
[[ -f "$dir/bin/backup-db.sh" ]] && cp -p "$dir/bin/backup-db.sh" "$dir/bin/backup-db.sh.prev"
mv "$dir/backup.env.new" "$dir/backup.env"
mv "$dir/bin/backup-db.sh.new" "$dir/bin/backup-db.sh"

# A new access policy can take up to 30 seconds to take effect.
sleep 30
# </dev/null: this script arrives on stdin, and docker compose exec inside
# backup-db.sh would otherwise read (and swallow) the rest of it.
if ! "$dir/bin/backup-db.sh" </dev/null; then
  echo "Test backup with the new token failed; restoring the previous config." >&2
  [[ -f "$dir/backup.env.prev" ]] && mv "$dir/backup.env.prev" "$dir/backup.env"
  [[ -f "$dir/bin/backup-db.sh.prev" ]] && mv "$dir/bin/backup-db.sh.prev" "$dir/bin/backup-db.sh"
  exit 1
fi
rm -f "$dir/backup.env.prev" "$dir/bin/backup-db.sh.prev"

line="$1 $dir/bin/backup-db.sh >> $dir/backup.log 2>&1"
{ crontab -l 2>/dev/null | grep -v "$dir/bin/backup-db.sh" || true; echo "$line"; } | crontab -
echo "Cron: $line"
REMOTE
unset SAS
# The new token passed its test backup: keep its policy.
NEW_POLICY=""

# The new token works: revoke every older one.
for old_policy in $(az storage container policy list \
  --container-name "$CONTAINER" \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$ACCOUNT_KEY" \
  --query "keys(@)" --output tsv); do
  if [[ "$old_policy" == "$POLICY_PREFIX"* && "$old_policy" != "$POLICY_NAME" ]]; then
    az storage container policy delete \
      --container-name "$CONTAINER" \
      --name "$old_policy" \
      --account-name "$STORAGE_ACCOUNT" \
      --account-key "$ACCOUNT_KEY" \
      --output none
    echo "Revoked old backup token (policy $old_policy)."
  fi
done
unset ACCOUNT_KEY

echo "Backups go to $CONTAINER_URL (kept $RETENTION_DAYS days)."
echo "Backup token valid until $SAS_EXPIRES: re-run this script before then."
if [[ -z "${BACKUP_HEALTHCHECK_URL:-}" ]]; then
  echo "Tip: set BACKUP_HEALTHCHECK_URL (e.g. a free healthchecks.io check) to get emailed about failed or missed backups."
fi
