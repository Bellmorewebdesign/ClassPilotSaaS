# Exposing ClassPilot with a Cloudflare Tunnel (optional)

You do **not** need this to develop locally. It is here for the case where you
want the dashboard reachable from your phone, or want the extension to sync to
a machine that is not the one you are browsing on — **without opening a single
router port**. `cloudflared` dials outbound to Cloudflare and traffic comes
back down that connection.

Suggested hostnames:

```
api.classpilot.example   ->  http://api:4000
app.classpilot.example   ->  http://web:3000
```

## Setup

1. Add your domain to Cloudflare (it must use Cloudflare DNS).
2. Zero Trust dashboard → **Networks → Tunnels → Create a tunnel** → pick
   *Cloudflared*. Name it `classpilot`.
3. Copy the tunnel token and put it in `.env`:

   ```bash
   CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...
   ```

4. Add two **public hostnames** to the tunnel:

   | Hostname | Service |
   |---|---|
   | `api.classpilot.example` | `http://api:4000` |
   | `app.classpilot.example` | `http://web:3000` |

   Use the compose *service* names (`api`, `web`) — `cloudflared` runs inside
   the same compose network.

5. Start it:

   ```bash
   docker compose --profile tunnel up -d
   ```

## Point ClassPilot at the tunnel

Once the hostnames resolve, update `.env` and restart:

```bash
CORS_ORIGINS=https://app.classpilot.example
NEXT_PUBLIC_API_URL=https://api.classpilot.example
```

```bash
docker compose up -d
```

Then in the extension popup → **Settings**, set the API URL to
`https://api.classpilot.example` and save. Chrome will ask to grant host
permission for that origin; accept it.

## Security notes

- A Cloudflare Tunnel makes these hostnames **public**. ClassPilot V1 has a
  single shared dev token and no real user authentication, so anyone who
  obtains that token can read your synced coursework.
- Put **Cloudflare Access** in front of both hostnames (Zero Trust →
  Access → Applications) and restrict to your own email before leaving a
  tunnel running. This is the single most important step on this page.
- Rotate `DEV_EXTENSION_TOKEN` (`openssl rand -hex 32`) whenever you suspect
  it leaked. Restarting the API revokes every previously issued token.
- Keep `ALLOW_EXTENSION_ORIGINS=true` only while you actually use the
  extension against this deployment.
- Add your tunnel's egress IPs to the MongoDB Atlas **Network Access**
  allow-list, or Atlas will refuse the connection.
