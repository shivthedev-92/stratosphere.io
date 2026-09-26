# Archived deploy targets

Stratosphere deploys to Azure (see [`deploy/azure/`](../azure/) and [docs/deployment/azure.md](../../docs/deployment/azure.md)). These older configurations are kept for reference only and are not maintained.

| Folder | What it was | To use it again |
|---|---|---|
| `aws/` | One EC2 instance with Docker Compose + Caddy ([guide](../../docs/archive/aws-deployment.md)) | Move both files back to the repo root; the compose file's `./backend`, `./frontend` and `./deploy/Caddyfile` paths assume the root. |
| `render/` | Render blueprint (API + Postgres, free plan) | Move `render.yaml` back to the repo root; Render only reads it from there. |
| `netlify/` | Netlify build for the Next.js frontend | Move `netlify.toml` back to the repo root; Netlify only reads it from there. |

**Moving these files does not stop a connected platform**: Netlify kept building after `netlify.toml` moved, because its build settings also live in the Netlify dashboard. On 2026-09-26 Netlify's GitHub app access to this repository was removed, which stopped it. To stop a connected platform, remove its access (GitHub → Settings → Applications → Installed GitHub Apps) or stop builds in its dashboard.
