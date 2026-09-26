# Archived deploy targets

Stratosphere deploys to Azure (see [`deploy/azure/`](../azure/) and [docs/deployment/azure.md](../../docs/deployment/azure.md)). These older configurations are kept for reference only and are not maintained.

| Folder | What it was | To use it again |
|---|---|---|
| `aws/` | One EC2 instance with Docker Compose + Caddy ([guide](../../docs/archive/aws-deployment.md)) | Move both files back to the repo root; the compose file's `./backend`, `./frontend` and `./deploy/Caddyfile` paths assume the root. |
| `render/` | Render blueprint (API + Postgres, free plan) | Move `render.yaml` back to the repo root; Render only reads it from there. |
| `netlify/` | Netlify build for the Next.js frontend | Move `netlify.toml` back to the repo root; Netlify only reads it from there. |

Moving `render.yaml` and `netlify.toml` here disabled any auto-deploys those platforms had connected to this repository.
