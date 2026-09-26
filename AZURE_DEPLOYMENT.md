# Azure single-VM deployment

This is the recommended production path for the current Stratosphere architecture: one Azure Linux VM running Caddy, Next.js, FastAPI, and PostgreSQL with Docker Compose. Only ports 80 and 443 are public; SSH is restricted to the operator's IP, and the database and application containers are private to the Compose network.

## Before creating resources

- Confirm the selected subscription's current free-services allowance and VM availability. `Standard_B2ats_v2` is the default because qualifying Azure free accounts may include 750 hours per month for 12 months, but eligibility and regional capacity vary.
- Create a cost budget and alerts in Azure Cost Management. A static public IP, disk, outbound traffic, backups, and any larger VM can still incur charges.
- Install Azure CLI, run `az login`, and select the intended subscription with `az account set --subscription ...`.
- Have an SSH key pair ready. The provisioning script accepts only public-key authentication.

`Standard_B2ats_v2` has 2 vCPUs and 1 GiB RAM. The bootstrap script adds 4 GiB of swap and deployments build images sequentially. If builds or runtime traffic outgrow it, set `AZURE_VM_SIZE=Standard_B2als_v2` (or another appropriately priced size) before provisioning.

## 1. Provision the VM

From the repository root, discover your public IP and export the required settings:

```bash
export AZURE_SSH_SOURCE_CIDR="YOUR_PUBLIC_IP/32"
export AZURE_SSH_PUBLIC_KEY_PATH="/absolute/path/to/id_ed25519.pub"
export AZURE_LOCATION="centralindia"
```

Optionally override `AZURE_RESOURCE_GROUP`, `AZURE_VM_NAME`, `AZURE_ADMIN_USER`, or `AZURE_VM_SIZE`. Then run:

```bash
./deploy/azure/provision-vm.sh
```

Save the public IP printed by the script. The NSG permits SSH only from `AZURE_SSH_SOURCE_CIDR` and permits public HTTP/HTTPS. PostgreSQL, FastAPI, and Next.js ports are not exposed.

## 2. Bootstrap Ubuntu

Copy and run the bootstrap script:

```bash
scp -i /absolute/path/to/id_ed25519 deploy/azure/bootstrap-vm.sh azureuser@VM_PUBLIC_IP:/tmp/
ssh -i /absolute/path/to/id_ed25519 azureuser@VM_PUBLIC_IP 'sudo bash /tmp/bootstrap-vm.sh'
```

Reconnect after it completes so the Docker group membership takes effect.

## 3. Configure production secrets and TLS

Create the ignored environment file locally:

```bash
cp .env.azure.example .env.azure
openssl rand -base64 36
openssl rand -hex 32
```

Use the generated values for `POSTGRES_PASSWORD` and `JWT_SECRET`. For the first deployment, set both URL fields using the static VM public IP:

```dotenv
SITE_ADDRESS=YOUR-PUBLIC-IP-WITH-DASHES.sslip.io
PUBLIC_URL=https://YOUR-PUBLIC-IP-WITH-DASHES.sslip.io
```

For example, `20.40.60.80` becomes `20-40-60-80.sslip.io`. Caddy will obtain and renew a trusted certificate. For a permanent domain, create an A record pointing to the static IP and put that hostname in both fields instead.

Leave `AI_PROVIDER=disabled` unless an Anthropic key is configured. Password-reset email requires the optional SMTP fields.

## 4. Deploy the tested working tree

The deploy script packages the current working tree, excluding Git metadata, build output, local environments, and secret files. It uploads `.env.azure` separately with mode `0600`, builds sequentially on the VM, runs migrations through the API container entrypoint, starts the stack, and waits for the public readiness endpoint.

```bash
export AZURE_VM_HOST="VM_PUBLIC_IP"
export AZURE_SSH_PRIVATE_KEY_PATH="/absolute/path/to/id_ed25519"
export AZURE_ADMIN_USER="azureuser"
./deploy/azure/deploy.sh
```

The final URL is `https://SITE_ADDRESS`. A successful readiness response includes `"ok": true` and confirms the database connection.

## Operations

Run Compose commands from the active release:

```bash
ssh -i /absolute/path/to/id_ed25519 azureuser@VM_PUBLIC_IP
cd /opt/stratosphere/current
docker compose --project-name stratosphere --env-file .env.azure --file docker-compose.azure.yml ps
docker compose --project-name stratosphere --env-file .env.azure --file docker-compose.azure.yml logs --tail=200
```

Create an encrypted off-VM database backup before each deployment. At minimum, make a dump and copy it to protected storage:

```bash
docker compose --project-name stratosphere --env-file .env.azure --file docker-compose.azure.yml exec -T db \
  pg_dump -U stratosphere -d stratosphere -Fc > stratosphere.dump
```

Do not rely on the VM disk as the only backup. Periodically test restoration, apply Ubuntu security updates, review Azure cost alerts, and rotate application secrets.

## Tear down

After exporting any required data, deleting the resource group removes the VM and associated resources created by the provisioning script:

```bash
az group delete --name stratosphere-demo-rg
```

Resource-group deletion is destructive and database data is not recoverable unless it was backed up elsewhere.
