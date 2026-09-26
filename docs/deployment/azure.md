# Azure single-VM deployment

This is the recommended production path for the current Stratosphere architecture: one Azure Linux VM running Caddy, Next.js, FastAPI, and PostgreSQL with Docker Compose. Only ports 80 and 443 are public; SSH is restricted to the operator's IP, and the database and application containers are private to the Compose network.

## Before creating resources

- Confirm the selected subscription's current free-services allowance and VM availability. `Standard_B2ats_v2` is the default because qualifying Azure free accounts may include 750 hours per month for 12 months, but eligibility and regional capacity vary.
- Create a cost budget and alerts in Azure Cost Management. A static public IP, disk, outbound traffic, backups, and any larger VM can still incur charges.
- Install Azure CLI, run `az login`, and select the intended subscription with `az account set --subscription ...`.
- Have an SSH key pair ready. The provisioning script accepts only public-key authentication.

`Standard_B2ats_v2` is not offered to every subscription in every region. On a new free-trial subscription (checked 2026-09-26) it was unavailable in Central India but available in **South India**, which is now the default. Check a region with:

```bash
az vm list-skus --location southindia --size Standard_B2ats_v2 --resource-type virtualMachines \
  --query "[].{name:name, restrictions:restrictions[].reasonCode}" -o table
```

An empty restrictions column means it is available. The VM uses Trusted Launch (Secure Boot and vTPM), Azure's default; the older "Standard" security type now needs a subscription feature flag.

`Standard_B2ats_v2` has 2 vCPUs and 1 GiB RAM. The bootstrap script adds 4 GiB of swap and deployments build images sequentially. If builds or runtime traffic outgrow it, set `AZURE_VM_SIZE=Standard_B2als_v2` (or another appropriately priced size) before provisioning.

## 1. Provision the VM

From the repository root, discover your public IP and export the required settings:

```bash
export AZURE_SSH_SOURCE_CIDR="YOUR_PUBLIC_IP/32"
export AZURE_SSH_PUBLIC_KEY_PATH="/absolute/path/to/id_ed25519.pub"
export AZURE_LOCATION="southindia"
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
cp deploy/azure/.env.azure.example deploy/azure/.env.azure
openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # JWT_SECRET (run again for a different value)
```

Use one value for `POSTGRES_PASSWORD` and the other for `JWT_SECRET`. Keep the database password to letters and digits (hex is ideal): it sits inside the database URL, where characters such as `/`, `@` or `+` from base64 break the connection. For the first deployment, set both URL fields using the static VM public IP:

```dotenv
SITE_ADDRESS=YOUR-PUBLIC-IP-WITH-DASHES.sslip.io
PUBLIC_URL=https://YOUR-PUBLIC-IP-WITH-DASHES.sslip.io
```

For example, `20.40.60.80` becomes `20-40-60-80.sslip.io`. Caddy will obtain and renew a trusted certificate. For a permanent domain, create an A record pointing to the static IP and put that hostname in both fields instead.

The AI coach uses Claude Haiku 4.5: set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`, or set `AI_PROVIDER=disabled` to turn the coach off. Password-reset email requires the optional SMTP fields.

## 4. Deploy the tested working tree

The deploy script packages only the git-tracked files under `backend/`, `frontend/` and `deploy/`, including uncommitted edits to them (it lists those first). Untracked and git-ignored files, such as personal notes, local `.env` files and design archives, never leave your machine. It uploads `deploy/azure/.env.azure` separately with mode `0600`, builds sequentially on the VM, runs migrations through the API container entrypoint, starts the stack, and waits for the public readiness endpoint.

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
docker compose --project-name stratosphere --env-file .env.azure --file deploy/azure/docker-compose.azure.yml ps
docker compose --project-name stratosphere --env-file .env.azure --file deploy/azure/docker-compose.azure.yml logs --tail=200
```

### Nightly backups

After the first successful deploy, set up automatic backups once:

```bash
export AZURE_VM_HOST="VM_PUBLIC_IP"
export AZURE_SSH_PRIVATE_KEY_PATH="/absolute/path/to/id_ed25519"
./deploy/azure/setup-backups.sh
```

It creates a private storage account and a `db-backups` container, a lifecycle rule that deletes backups after 30 days (`BACKUP_RETENTION_DAYS`), and a one-year, create-only SAS token issued under a stored access policy. It installs `backup-db.sh` and a cron job on the VM (01:47 IST daily) and runs one backup straight away. The VM can add backups but cannot overwrite, read, list or delete them, so a compromised server cannot wipe or tamper with them. Re-run the script to rotate the token: it replaces the access policy, which revokes the previous token immediately. If a token may have leaked outside that process, also regenerate the storage account key used to sign it (`az storage account keys renew --key key1`). The log is `/opt/stratosphere/backup.log` on the VM.

To restore, download a dump with your own Azure login and load it into the database container:

```bash
az storage blob list --account-name ACCOUNT --container-name db-backups --auth-mode login -o table
az storage blob download --account-name ACCOUNT --container-name db-backups --auth-mode login \
  --name stratosphere-YYYYMMDDTHHMMSSZ.dump --file restore.dump
scp -i KEY restore.dump azureuser@VM_PUBLIC_IP:/tmp/
# on the VM, from /opt/stratosphere/current:
docker compose --project-name stratosphere --env-file .env.azure --file deploy/azure/docker-compose.azure.yml exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < /tmp/restore.dump
```

`--auth-mode login` needs the "Storage Blob Data Reader" role on the account for your user; alternatively pass `--account-key`. Test a restore occasionally.

For a one-off backup before a risky change, make a dump by hand:

```bash
docker compose --project-name stratosphere --env-file .env.azure --file deploy/azure/docker-compose.azure.yml exec -T db \
  pg_dump -U stratosphere -d stratosphere -Fc > stratosphere.dump
```

Do not rely on the VM disk as the only backup. Periodically test restoration, apply Ubuntu security updates, review Azure cost alerts, and rotate application secrets.

## Tear down

After exporting any required data, deleting the resource group removes the VM and associated resources created by the provisioning script:

```bash
# Use the same resource group you provisioned into (the default is stratosphere-demo-rg).
az group delete --name "${AZURE_RESOURCE_GROUP:-stratosphere-demo-rg}"
```

Resource-group deletion is destructive and database data is not recoverable unless it was backed up elsewhere.

## Telegram reminders (optional)

Timed tasks can send a Telegram message when they are due. The bot runs inside the API container (long polling, no extra port or webhook).

1. In Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot`, and follow the prompts.
2. Put the token and the bot's username (without `@`) in `deploy/azure/.env.azure`:
   ```
   TELEGRAM_BOT_TOKEN=123456789:AA...
   TELEGRAM_BOT_USERNAME=YourStratosphereBot
   ```
3. Redeploy. Each user then connects from **Settings → Telegram reminders → Connect Telegram** and presses **Start** in the bot.

Only one server can poll a bot at a time: while production uses the bot, run local development with `TELEGRAM_BOT_TOKEN` empty (or a separate test bot), otherwise the two fight over updates and Telegram returns "Conflict" errors.

Reminders arrive within about 30 seconds of the task's time. Messages contain the task title only. Treat the token like a password: anyone with it can send messages as the bot.
