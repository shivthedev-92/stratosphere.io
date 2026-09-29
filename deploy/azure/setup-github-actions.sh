#!/usr/bin/env bash
# One-time setup so GitHub Actions can deploy to the VM using OIDC:
# no Azure password or SSH key is stored in GitHub.
set -euo pipefail

readonly RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-stratosphere-demo-rg}"
readonly VM_NAME="${AZURE_VM_NAME:-stratosphere-demo-vm}"
readonly APP_NAME="${AZURE_DEPLOY_APP_NAME:-stratosphere-github-deploy}"
readonly SITE_ADDRESS="${SITE_ADDRESS:?Set SITE_ADDRESS to the production hostname from .env.azure}"
readonly ENVIRONMENT="production"

for tool in az gh jq; do
  command -v "$tool" >/dev/null || { echo "$tool is required." >&2; exit 1; }
done

REPO="${GITHUB_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
readonly REPO
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
VM_ID="$(az vm show -g "$RESOURCE_GROUP" -n "$VM_NAME" --query id -o tsv)"
readonly SUBSCRIPTION_ID TENANT_ID VM_ID

echo "Repository:   $REPO"
echo "Subscription: $SUBSCRIPTION_ID"
echo "VM:           $VM_ID"

APP_ID="$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)"
if [[ -z "$APP_ID" ]]; then
  APP_ID="$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)"
  echo "Created app registration $APP_NAME"
fi
readonly APP_ID

SP_OBJECT_ID="$(az ad sp show --id "$APP_ID" --query id -o tsv 2>/dev/null || true)"
if [[ -z "$SP_OBJECT_ID" ]]; then
  SP_OBJECT_ID="$(az ad sp create --id "$APP_ID" --query id -o tsv)"
fi
readonly SP_OBJECT_ID

# Only jobs that run in the protected "production" environment can sign in.
readonly SUBJECT="repo:$REPO:environment:$ENVIRONMENT"
if [[ -z "$(az ad app federated-credential list --id "$APP_ID" --query "[?subject=='$SUBJECT'].name" -o tsv)" ]]; then
  az ad app federated-credential create --id "$APP_ID" --parameters "$(jq -n \
    --arg subject "$SUBJECT" \
    '{name: "github-production", issuer: "https://token.actions.githubusercontent.com",
      subject: $subject, audiences: ["api://AzureADTokenExchange"]}')" >/dev/null
  echo "Added federated credential for $SUBJECT"
fi

# Run Command needs runCommand/write; scope the role to this VM only.
if [[ -z "$(az role assignment list --assignee "$SP_OBJECT_ID" --scope "$VM_ID" \
  --role "Virtual Machine Contributor" --query "[0].id" -o tsv)" ]]; then
  az role assignment create \
    --assignee-object-id "$SP_OBJECT_ID" \
    --assignee-principal-type ServicePrincipal \
    --role "Virtual Machine Contributor" \
    --scope "$VM_ID" >/dev/null
  echo "Granted Virtual Machine Contributor on $VM_NAME"
fi

# Environment: you approve every deploy, and only main can deploy.
USER_ID="$(gh api user --jq .id)"
jq -n --argjson id "$USER_ID" \
  '{reviewers: [{type: "User", id: $id}],
    deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}}' \
  | gh api --method PUT "repos/$REPO/environments/$ENVIRONMENT" --input - >/dev/null
if ! gh api "repos/$REPO/environments/$ENVIRONMENT/deployment-branch-policies" \
  --jq '.branch_policies[].name' | grep -qx main; then
  gh api --method POST "repos/$REPO/environments/$ENVIRONMENT/deployment-branch-policies" \
    -f name=main -f type=branch >/dev/null
fi

gh secret set AZURE_CLIENT_ID --repo "$REPO" --env "$ENVIRONMENT" --body "$APP_ID"
gh secret set AZURE_TENANT_ID --repo "$REPO" --env "$ENVIRONMENT" --body "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID --repo "$REPO" --env "$ENVIRONMENT" --body "$SUBSCRIPTION_ID"
gh variable set AZURE_RESOURCE_GROUP --repo "$REPO" --env "$ENVIRONMENT" --body "$RESOURCE_GROUP"
gh variable set AZURE_VM_NAME --repo "$REPO" --env "$ENVIRONMENT" --body "$VM_NAME"
gh variable set SITE_ADDRESS --repo "$REPO" --env "$ENVIRONMENT" --body "$SITE_ADDRESS"

echo
echo "Done. Merges to main now deploy after you approve them under Actions > Deploy."
