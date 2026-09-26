#!/usr/bin/env bash
# One-time setup for nightly database backups (run locally after the first
# deploy). Safe to re-run: it reuses the storage account and replaces the
# SAS token, config file and cron entry.
#
# Creates a private storage account and container, a lifecycle rule that
# deletes backups after BACKUP_RETENTION_DAYS, and a create-only SAS
# token under a revocable stored access policy. Then installs backup-db.sh and a nightly cron job on the VM and runs
# one backup to prove it works.
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-stratosphere-demo-rg}"
readonly LOCATION="${AZURE_LOCATION:-southindia}"
readonly VM_HOST="${AZURE_VM_HOST:?Set AZURE_VM_HOST to the VM public IP or hostname}"
readonly ADMIN_USER="${AZURE_ADMIN_USER:-azureuser}"
readonly SSH_PRIVATE_KEY_PATH="${AZURE_SSH_PRIVATE_KEY_PATH:?Set AZURE_SSH_PRIVATE_KEY_PATH to your private key file}"
readonly CONTAINER="db-backups"
readonly RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
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
trap 'rm -f -- "$POLICY_FILE"' EXIT
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
# is rotated). Each run replaces the previous policy, which revokes the
# old token. Create-only ("c"): the VM can add new backups but can never
# overwrite, read, list or delete existing ones.
readonly POLICY_PREFIX="vm-backup-writer-"
POLICY_NAME="${POLICY_PREFIX}$(date -u +%Y%m%d%H%M%S)"
readonly POLICY_NAME
for old_policy in $(az storage container policy list \
  --container-name "$CONTAINER" \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$ACCOUNT_KEY" \
  --query "keys(@)" --output tsv); do
  if [[ "$old_policy" == "$POLICY_PREFIX"* ]]; then
    az storage container policy delete \
      --container-name "$CONTAINER" \
      --name "$old_policy" \
      --account-name "$STORAGE_ACCOUNT" \
      --account-key "$ACCOUNT_KEY" \
      --output none
    echo "Revoked old backup token (policy $old_policy)."
  fi
done
az storage container policy create \
  --container-name "$CONTAINER" \
  --name "$POLICY_NAME" \
  --permissions c \
  --expiry "$(date -u -d '+1 year' +%Y-%m-%dT%H:%MZ)" \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$ACCOUNT_KEY" \
  --output none
SAS="$(az storage container generate-sas \
  --name "$CONTAINER" \
  --policy-name "$POLICY_NAME" \
  --https-only \
  --account-name "$STORAGE_ACCOUNT" \
  --account-key "$ACCOUNT_KEY" \
  --output tsv)"
unset ACCOUNT_KEY

readonly CONTAINER_URL="https://$STORAGE_ACCOUNT.blob.core.windows.net/$CONTAINER"

ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" "mkdir -p /opt/stratosphere/bin"
scp "${SSH_OPTIONS[@]}" "$SCRIPT_DIR/backup-db.sh" "$SSH_TARGET:/opt/stratosphere/bin/backup-db.sh"
# The SAS goes over stdin so it never appears in a process list.
printf 'BACKUP_CONTAINER_URL=%s\nBACKUP_SAS=%s\n' "$CONTAINER_URL" "$SAS" \
  | ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" \
    "umask 077 && cat > /opt/stratosphere/backup.env && chmod 700 /opt/stratosphere/bin/backup-db.sh"
unset SAS

# ssh joins its arguments into one remote command line, so quote the
# schedule for the remote shell or its spaces and "*" get split and expanded.
ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" "bash -s -- $(printf '%q' "$CRON_SCHEDULE")" <<'REMOTE'
set -euo pipefail
line="$1 /opt/stratosphere/bin/backup-db.sh >> /opt/stratosphere/backup.log 2>&1"
{ crontab -l 2>/dev/null | grep -v '/opt/stratosphere/bin/backup-db.sh' || true; echo "$line"; } | crontab -
echo "Cron: $line"
# A new access policy can take up to 30 seconds to take effect.
sleep 30
/opt/stratosphere/bin/backup-db.sh
REMOTE

echo "Backups go to $CONTAINER_URL (kept $RETENTION_DAYS days)."
