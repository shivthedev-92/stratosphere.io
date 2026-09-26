#!/usr/bin/env bash
set -euo pipefail

readonly RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-stratosphere-demo-rg}"
readonly LOCATION="${AZURE_LOCATION:-centralindia}"
readonly VM_NAME="${AZURE_VM_NAME:-stratosphere-demo-vm}"
readonly ADMIN_USER="${AZURE_ADMIN_USER:-azureuser}"
readonly VM_SIZE="${AZURE_VM_SIZE:-Standard_B2ats_v2}"
readonly SSH_SOURCE_CIDR="${AZURE_SSH_SOURCE_CIDR:?Set AZURE_SSH_SOURCE_CIDR to your public IP with /32}"
readonly SSH_PUBLIC_KEY_PATH="${AZURE_SSH_PUBLIC_KEY_PATH:?Set AZURE_SSH_PUBLIC_KEY_PATH to your public key file}"

readonly VNET_NAME="${VM_NAME}-vnet"
readonly SUBNET_NAME="app"
readonly NSG_NAME="${VM_NAME}-nsg"
readonly PUBLIC_IP_NAME="${VM_NAME}-ip"
readonly NIC_NAME="${VM_NAME}-nic"

if [[ ! -f "$SSH_PUBLIC_KEY_PATH" ]]; then
  echo "SSH public key not found: $SSH_PUBLIC_KEY_PATH" >&2
  exit 1
fi

if [[ ! "$SSH_SOURCE_CIDR" =~ ^[0-9a-fA-F:.]+/[0-9]{1,3}$ ]]; then
  echo "AZURE_SSH_SOURCE_CIDR must be a single IPv4 or IPv6 CIDR, normally your-public-ip/32." >&2
  exit 1
fi

az account show --output none

az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags project=stratosphere environment=production \
  --output none

az network vnet create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VNET_NAME" \
  --address-prefixes 10.20.0.0/16 \
  --subnet-name "$SUBNET_NAME" \
  --subnet-prefixes 10.20.1.0/24 \
  --output none

az network nsg create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$NSG_NAME" \
  --location "$LOCATION" \
  --output none

az network nsg rule create \
  --resource-group "$RESOURCE_GROUP" \
  --nsg-name "$NSG_NAME" \
  --name AllowSSHFromOperator \
  --priority 100 \
  --access Allow \
  --protocol Tcp \
  --direction Inbound \
  --source-address-prefixes "$SSH_SOURCE_CIDR" \
  --destination-port-ranges 22 \
  --output none

az network nsg rule create \
  --resource-group "$RESOURCE_GROUP" \
  --nsg-name "$NSG_NAME" \
  --name AllowHTTP \
  --priority 110 \
  --access Allow \
  --protocol Tcp \
  --direction Inbound \
  --source-address-prefixes Internet \
  --destination-port-ranges 80 \
  --output none

az network nsg rule create \
  --resource-group "$RESOURCE_GROUP" \
  --nsg-name "$NSG_NAME" \
  --name AllowHTTPS \
  --priority 120 \
  --access Allow \
  --protocol Tcp \
  --direction Inbound \
  --source-address-prefixes Internet \
  --destination-port-ranges 443 \
  --output none

az network public-ip create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PUBLIC_IP_NAME" \
  --location "$LOCATION" \
  --sku Standard \
  --allocation-method Static \
  --output none

az network nic create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$NIC_NAME" \
  --location "$LOCATION" \
  --vnet-name "$VNET_NAME" \
  --subnet "$SUBNET_NAME" \
  --network-security-group "$NSG_NAME" \
  --public-ip-address "$PUBLIC_IP_NAME" \
  --output none

az vm create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --location "$LOCATION" \
  --nics "$NIC_NAME" \
  --image Ubuntu2404 \
  --size "$VM_SIZE" \
  --admin-username "$ADMIN_USER" \
  --ssh-key-values "$SSH_PUBLIC_KEY_PATH" \
  --os-disk-size-gb 64 \
  --storage-sku Premium_LRS \
  --security-type Standard \
  --os-disk-delete-option Delete \
  --tags project=stratosphere environment=production \
  --output none

PUBLIC_IP="$(az network public-ip show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PUBLIC_IP_NAME" \
  --query ipAddress \
  --output tsv)"

echo "Azure VM is ready:"
echo "  Public IP: $PUBLIC_IP"
echo "  SSH: ssh -i $SSH_PUBLIC_KEY_PATH $ADMIN_USER@$PUBLIC_IP"
echo "  Temporary HTTPS hostname: ${PUBLIC_IP//./-}.sslip.io"
