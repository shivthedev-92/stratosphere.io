# AWS Recruiter Demo Deployment

> **Archived.** Azure is the supported target; see [docs/deployment/azure.md](../deployment/azure.md). This guide's files now live in `deploy/archive/aws/` - move them back to the repo root before following it.

This guide deploys Stratosphere to one EC2 instance. It is intentionally small and inexpensive,
not highly available. The instance runs Caddy, Next.js, FastAPI, and PostgreSQL with Docker Compose.

## Architecture

```text
Browser --HTTPS--> Caddy --> Next.js
                         \-> /api/* --> FastAPI --> PostgreSQL
```

Caddy obtains and renews the TLS certificate. PostgreSQL is not published to the internet. The web
client uses an HttpOnly, Secure, SameSite cookie; the mobile client can continue using bearer tokens.

## AWS Free Tier note

AWS accounts created on or after July 15, 2025 use credits rather than the old 12-month allowance.
The free plan ends after six months or when credits are exhausted. Confirm eligibility in the Billing
console before creating resources and create a zero-dollar or low-dollar AWS Budget first.

## 1. Create the EC2 host

Recommended demo configuration:

- Ubuntu Server 24.04 LTS, 64-bit x86
- `t3.small` when shown as Free Tier eligible; otherwise choose an eligible micro/small type
- 20 GiB encrypted `gp3` root volume
- Elastic IP only if you need a stable address; release it when the demo is removed
- IAM role allowing uploads only to a dedicated backup S3 bucket, if backups are enabled

Security group inbound rules:

| Port | Source | Purpose |
| --- | --- | --- |
| 22 | Your IP only | Administration |
| 80 | `0.0.0.0/0`, `::/0` | TLS certificate and redirect |
| 443 | `0.0.0.0/0`, `::/0` | Application |

Do not open ports 3000, 5432, or 8000.

## 2. Install Docker

SSH into the instance and install Docker from Docker's official Ubuntu repository. Add the Ubuntu user
to the `docker` group, log out, and reconnect. Verify with:

```bash
docker version
docker compose version
```

On a small instance, add 2 GiB of swap before building the Next.js image to avoid an out-of-memory
failure during `next build`.

## 3. Configure DNS and secrets

Use a domain you control when possible. For a temporary demo without a purchased domain, a hostname
such as `<PUBLIC_IP>.sslip.io` resolves to the embedded public IP. Do not include `http://` in
`SITE_ADDRESS`.

```bash
git clone <your-repository-url> stratosphere.io
cd stratosphere.io
cp .env.aws.example .env.aws
chmod 600 .env.aws
```

Edit `.env.aws`:

```text
SITE_ADDRESS=<PUBLIC_IP>.sslip.io
PUBLIC_URL=https://<PUBLIC_IP>.sslip.io
POSTGRES_PASSWORD=<long random value>
JWT_SECRET=<at least 32 random bytes>
```

Generate secrets with `openssl rand -hex 32`. The production Compose file disables public API docs
and the AI coach by default.

## 4. Deploy

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml up -d --build
docker compose --env-file .env.aws -f docker-compose.aws.yml ps
docker compose --env-file .env.aws -f docker-compose.aws.yml logs --tail=100 api caddy
```

Migrations run automatically before the API starts. Confirm:

```bash
curl -fsS https://<hostname>/api/health
```

Then complete the smoke-test checklist below.

## 5. Optional email and AI

Password reset works end-to-end when SMTP is configured. AWS SES SMTP credentials can be supplied as:

```text
SMTP_HOST=email-smtp.<region>.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=<SES SMTP username>
SMTP_PASSWORD=<SES SMTP password>
SMTP_FROM_EMAIL=<verified sender>
SMTP_USE_TLS=true
```

SES sandbox accounts can only send to verified recipients. Without SMTP, reset requests intentionally
return the same generic response but no email is delivered.

To enable the hosted AI coach, set `AI_PROVIDER=anthropic` and provide `ANTHROPIC_API_KEY`. User task
and reflection context is sent to that provider. Do not run Ollama on this small shared instance.

## 6. Backups and updates

Create a database backup before every deployment:

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml exec -T db \
  pg_dump -U stratosphere -d stratosphere --format=custom > stratosphere.dump
```

Copy the dump to a private, encrypted S3 bucket if the demo contains data. Test restoration before
depending on backups. To update:

```bash
git pull --ff-only
docker compose --env-file .env.aws -f docker-compose.aws.yml up -d --build
docker image prune -f
```

## 7. Smoke test

1. Landing page and privacy page load over HTTPS.
2. Signup, logout, and login work.
3. Create, edit, complete, reflect on, and delete a task.
4. Cross-account task IDs return 404.
5. Notification actions work and missing IDs return 404.
6. Public support submission works and throttles repeated requests.
7. AI coach shows a controlled disabled message unless configured.
8. Password-reset email and consumption work if SMTP is configured.
9. Account deletion removes the user and prevents subsequent login.
10. Reboot the instance and confirm all containers recover.

## 8. Teardown

Export any required data, then terminate the EC2 instance, release its Elastic IP, delete unused EBS
snapshots, remove the backup bucket if appropriate, and verify the AWS Billing console shows no active
resources.
