# Handover: Azira jewellery store (updated 2026-11-20, evening)

This file says what exists, how the parts connect, what has been done and what is left. Read it fully before acting. Then read `CLAUDE.md` (working rules, they apply to you) and `docs/hosting.md` (the owner's hosting guide; the source of truth for every secret, variable and deploy step).

---

## 0. The 30-second version

- **What:** online jewellery store **Azira** (azira.com.au) for a client in Australia. Medusa v2 backend + Next.js storefront. Prices in AUD, 10% GST included. Stripe is the only payment method, but **Stripe is not set up yet** (waiting on the client's verification), so the site runs in **preview mode** (`CHECKOUT_PAUSED=true`: browse only, checkout refused with 403 `checkout_paused`).
- **Where it runs:** backend in Docker on an **AWS Lightsail** server in Sydney, reached only through a **Cloudflare Tunnel**; database on **Supabase** (Sydney); images on **Cloudflare R2**; storefront on **Cloudflare Workers** (Workers Paid). Deploys run from **GitHub Actions** when `main` changes.
- **Where we are: LIVE (preview mode) since 2026-11-20.**
  - Shop: https://azira.com.au (www redirects to it). 3 sample products, Australia region, AUD.
  - Store API: https://api.azira.com.au (`/health` says OK). Admin: https://admin.azira.com.au/app, behind Cloudflare Access (emailed code), then the Medusa login. First admin user: `azirasydney@gmail.com` (the owner chose the password).
  - Backend deploy run `44666178691` (commit `28b74b6`) and storefront run `44667060095` are green.
- **What's left:** the owner's launch items (section 8): Supabase Pro, Resend, Stripe, real catalogue, backups. A photo upload test (proves R2) was suggested but not yet confirmed.

---

## 1. People, accounts, repos

- **Owner** (the user you talk to): Windows PC, PowerShell, user folder `C:\Users\thisu`. Not a developer; short on time. Talk simply and lead with the result (`CLAUDE.md` rule 11). Do not ask them to paste secrets into the chat, ever.
- **Repo:** `https://github.com/Thisuranr/Jewellery-Ecom-Site` (GitHub owner `Thisuranr`; the image registry uses lowercase `thisuranr`).
  - `main` is the production branch: a push to `main` that touches backend paths deploys the backend (see section 4).
  - `claude/blissful-carson-tzzli7` is the development branch the cloud session used. **Right now `main` and this branch are the same commit** (this handover commit). Work on the dev branch, then fast-forward `main` when you want to deploy (`git push origin HEAD:main`). The owner approved updating `main` for deploys.
  - Don't open pull requests unless the owner asks.
- **Reference repo, read only:** `https://github.com/Thisuranr/teacher-store`, the owner's earlier clothing store on the same stack (Medusa v2 + Next.js). We ported the attributes module from it. **You may read it; never edit it** (the owner's explicit rule).
- **Accounts** (all the owner's; a friend holds some logins): GitHub, Cloudflare (domain, DNS, R2, Tunnel, Zero Trust/Access, Workers), Supabase, AWS (Lightsail), domain registrar Crazy Domains (nameservers already point at Cloudflare). **Not yet:** Stripe, Resend.
- **Store emails:** both inbox variables (`STORE_NOTIFY_EMAIL`, `CUSTOM_ORDER_EMAIL`) are set to the client's Gmail `azirasydney@gmail.com` for now. The sender `EMAIL_FROM` is `Azira <orders@azira.com.au>`.

---

## 2. What has been built (all committed)

Commit history, oldest first (`git log --oneline`):

| Commit | What |
|---|---|
| `64d3e83` | `CLAUDE.md`: project context + "How we work" token-saving rules |
| `c462762` | Research notes: `docs/research/jewellery-product-attributes.md` |
| `5137a1e` | Medusa v2 DTC starter set up for Australia (AUD, GST-inclusive prices, AU region, ship within Australia only) |
| `f3522a1` | Jewellery product attributes, ported from teacher-store: material type (solid gold, plated, vermeil, filled…), purity (9ct–24ct, 925, 950…), metal colour, stones, sizes, each with "Other / add your own" |
| `1daa262` | Emails (console in dev, Resend in prod), custom-order enquiry form + admin page, storefront attribute filters |
| `d78f8cd` | Fixes from the money/data (Tier A) reviews |
| `514162f` | One-command local setup: `pnpm setup:local` (see README) |
| `2e6bb5f`, `19ff4bf` | Storefront redesign: "simple but expensive" look, white background, black text, mega menu; listing, product, bag, checkout and account pages |
| `de7b822` | `CLAUDE.md` note: Claude usage now comes from the owner's weekly allowance |
| `b22feac` | Production hosting setup (Docker, compose, deploy scripts, Cloudflare docs, workflows, `docs/hosting.md`) |
| `6a95bc9` | Hosting hardening + **preview mode** (`CHECKOUT_PAUSED`) |
| `c78a67a` | Created `main` for production deploys |
| `bd7bd8b` | Hosting doc: shop inbox item in the Before-launch checklist |
| `34be3ef` | Server bootstrap works with Ubuntu 24.04's socket-activated sshd (Lightsail) |
| `fd9520c` | Docker attempt 1 (`--prefer-offline`), **did not fix the image build** |
| `fa1c3a9` | **Docker fix that works:** pnpm 10.28.0 (checksum-pinned) + `injectWorkspacePackages: true` + non-legacy `pnpm deploy`. Verified with a local Docker build and on GitHub |
| `5ab50e8` | Docs/bootstrap: Lightsail instead of DigitalOcean (removed the DigitalOcean monitoring-agent check, updated `docs/hosting.md` and `CLAUDE.md`) |
| `18f4802` | This handover file (first version) |
| `100ed2f` | `apply-env.sh`: accept GitHub's 2026 installation-token format (`ghs_` JWT, ~520 chars, dots and dashes). **Installed on the server by hand** (server scripts are not updated by deploys) |
| `28b74b6` | Seed works in preview mode (Stripe attached to the region only when the provider is enabled) and survives a re-run (reuses sales channel, publishable key, store, region). First green deploy |

### Code map

- Monorepo, **pnpm 10.28.0** (`packageManager` in root `package.json`, checksum-pinned), turbo. Use pnpm only; never hand-edit `pnpm-lock.yaml`.
- `apps/backend` (`@dtc/backend`): Medusa **2.22.2**.
  - `medusa-config.ts`: modules (translation, file storage local/R2, attributes, custom-enquiry, email, Stripe only when `STRIPE_API_KEY` is set, Redis modules only when `REDIS_URL` is set).
  - `src/modules/attributes`: jewellery attributes. `src/modules/custom-enquiry`: the contact form. `src/modules/email`: console/Resend provider.
  - `src/admin/widgets/product-attributes.tsx`, `src/admin/routes/{custom-enquiries,settings}`: admin extensions. The stock Medusa admin stays; the owner likes it.
  - `src/lib/`: `checkout-paused.ts` (preview mode: refuses cart completion and payment sessions with 403), `production-env.ts` (refuses to start in production with missing, unsafe or placeholder settings; lists them all), `database-tls.ts` (verified TLS to Supabase), `file-storage.ts`, `force-tax-inclusive-promotion.ts`, `sanitize-payment-session-body.ts`.
  - `src/migration-scripts/initial-data-seed.ts`: runs on the first `db:migrate`. Creates the AU region, AUD, tax, shipping, sales channel, the **publishable API key**, categories and **3 sample products**. `jewellery-attributes.ts` seeds the attribute options.
- `apps/storefront` (`@dtc/storefront`): Next.js 16, deployed to Cloudflare Workers via OpenNext. `wrangler.jsonc` holds the D1 cache id (`azira-tag-cache`, already created). The flag is `NEXT_PUBLIC_CHECKOUT_PAUSED`.
- `infra/`:
  - `docker/backend.Dockerfile`: stages pnpm → deps (`pnpm fetch`) → build (`medusa build`, `pnpm deploy --prod`) → runtime (non-root `node`, CMD `medusa start`).
  - `compose/docker-compose.prod.yml`: services `medusa`, `migrate` (profile), `redis`, `cloudflared`.
  - `deploy/`: `deploy-gate.sh` (forced SSH command for the `deploy` user, accepts only 3 requests), `apply-env.sh` (validates and writes `/opt/azira/.env` from the settings GitHub sends), `deploy.sh` (pull, migrate, start, health check, automatic rollback).
  - `vps/`: `bootstrap.sh` (server hardening + Docker), `make-user-data.sh` (first-boot script with the public keys and the image pin). Tests: `bash infra/vps/tests/test-bootstrap.sh` (85 pass), plus tests under `infra/deploy/tests` and `infra/backup/tests`.
  - `cloudflare/`: `access.md`, `r2.md`, `rules.md`, `tunnel-config.yml`. `backup/`: encrypted DB backups to R2 (not switched on yet).
- `.github/workflows/`: `ci.yml` (pull requests only), `backend-image.yml` (builds and pushes `ghcr.io/thisuranr/azira-backend:<sha>`), `backend-deploy.yml` (image + deploy over SSH), `deploy-storefront.yml`.
- `docker-compose.yml` + `scripts/local-setup.mjs`: local development (Postgres + Redis in Docker).

---

## 3. Production setup: what exists and how it connects

```
Customer ─► azira.com.au (Cloudflare Workers storefront, NOT deployed yet)
                 │ calls
                 ▼
     api.azira.com.au / admin.azira.com.au  (Cloudflare DNS → Cloudflare Tunnel)
                 │ (admin.* is behind Cloudflare Access: emailed code first)
                 ▼
  AWS Lightsail, Sydney, Ubuntu 24.04, 2 GB / 2 vCPU, US$12/month
  static IP 52.62.217.228 (Lightsail static IP "azira-ip"), hostname ip-172-26-5-191
  Lightsail firewall: SSH only. No web ports open; cloudflared dials out.
    Docker Compose in /opt/azira/compose:
      medusa       store API + admin + jobs, port 9000 (internal only)
      redis        sessions/queues/locks (password protected, internal)
      cloudflared  the tunnel (TUNNEL_TOKEN)
                 │
                 ├─► Supabase Postgres, project ref jiasljnsxhelgdakjgja (Sydney, FREE plan for now)
                 │     direct connection over IPv6, port 5432, verified TLS (SUPABASE_CA_CERT)
                 │     pg_trgm and unaccent extensions already created in schema public
                 └─► Cloudflare R2 bucket azira-images (served at img.azira.com.au)
```

Cloudflare account id: `7b7865326875e0dea1285c31309d77a4` (also in the R2 endpoint). R2 buckets: `azira-images`, `azira-next-cache`, `azira-db-backups`. D1: `azira-tag-cache`.

### Server details (already done; don't redo)

- Created on Lightsail, first-boot script run by hand (`sudo bash /root/azira-user-data.sh`, because Lightsail runs launch scripts with `sh`). Hardening report: `sudo bash /root/azira-infra/infra/vps/bootstrap.sh check` passed everything except the DigitalOcean agent line, which has since been removed from the script (the server still has the old copy; that's harmless).
- **Users on the server:**
  - `azadmin`: the owner's admin login. Key only, **passwordless sudo**. Private key on the PC: `C:\Users\thisu\azira-admin`. **It has a passphrase**, which the owner knows (it was recreated once after the first passphrase was lost). From PowerShell: `ssh azadmin@52.62.217.228`.
  - `deploy`: used only by GitHub Actions. Its `authorized_keys` forces `/opt/azira/bin/deploy-gate.sh`, so no shell. Its key pair is on the PC: **`C:\Users\thisu\azira-deploy`** (private, **no passphrase**) and `azira-deploy.pub`. The public half is already on the server.
- **Image pin:** `/opt/azira/image-pin.env` allows only image `ghcr.io/thisuranr/azira-backend` and registry user `thisuranr` (comparison is case-insensitive, so `Thisuranr` from GitHub is fine).
- Files on the server: settings `/opt/azira/.env` (root only, written by each deploy); compose `/opt/azira/compose/docker-compose.prod.yml` (+ `/opt/azira/compose/.env`); current image tag `/opt/azira/current_tag` (exists after the first successful deploy); deploy log `/opt/azira/deploy.log`; bootstrap log `/var/log/azira-bootstrap.log`.
- Windows `ssh-keyscan` fails (unsupported key exchange). Host key capture that worked: `ssh -o KexAlgorithms=curve25519-sha256 -o HostKeyAlgorithms=ssh-ed25519 -o StrictHostKeyChecking=accept-new azadmin@52.62.217.228`, then `Select-String $HOME\.ssh\known_hosts -Pattern 52.62.217.228`. `DEPLOY_KNOWN_HOSTS` is already set from that.

### GitHub configuration (state on 2026-11-20)

Secrets live in the **`production` environment** (Settings → Environments → production; limited to the `main` branch). Variables live at the repo level (Settings → Secrets and variables → Actions → Variables). The full list with explanations is in `docs/hosting.md` section 3.

- **Set and working** (all in the `production` environment): `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`, `DATABASE_URL` (direct connection, password tested), `SUPABASE_CA_CERT` (Supabase Root 2021 CA, sha256 `80:70:25:AD:…:CA:FA`, valid to 2031), `REDIS_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `TUNNEL_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (the seeded "Storefront" key).
- **No repository-level secrets remain** (the stale copies of `DEPLOY_SSH_KEY` and the two R2 keys were deleted).
- **Deliberately empty (preview mode):** `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_KEY`, `RESEND_API_KEY`.
- **Variables** (in the `production` environment, not repo level): `CHECKOUT_PAUSED=true`, `STORE_NOTIFY_EMAIL`, `CUSTOM_ORDER_EMAIL` (both `azirasydney@gmail.com`); the others use the defaults (Azira URLs). `STORE_ABN` and `EMAIL_REPLY_TO` are empty.

---

## 4. How a deploy works

1. A push to `main` that touches `apps/backend/**`, `infra/docker/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, root `package.json`, `.npmrc`, `.dockerignore` or the two backend workflow files starts **Backend deploy** (`.github/workflows/backend-deploy.yml`). It can also be run by hand: Actions → Backend deploy → Run workflow (optional input `sha` for a rollback). Changes to docs, `infra/vps` and `CLAUDE.md` do **not** trigger it. CI (`ci.yml`) runs only on pull requests.
2. Job 1, **Build the image**: builds `infra/docker/backend.Dockerfile` and pushes `ghcr.io/thisuranr/azira-backend:<commit sha>`. It skips the build if that tag already exists. **This job is green since `fa1c3a9`.**
3. Job 2, **Deploy to the droplet** (old name; it's the Lightsail server), environment `production`:
   - Writes `DEPLOY_SSH_KEY` to a file and checks that it contains `PRIVATE KEY`. **This is where it fails now.**
   - SSH as `deploy@DEPLOY_HOST` (host key checked against `DEPLOY_KNOWN_HOSTS`).
   - Sends the settings. `apply-env.sh` validates them, writes `/opt/azira/.env`, and runs `docker login ghcr.io` with the job's token.
   - Asks for a deploy of the sha. `deploy.sh` pulls the image, runs `medusa db:migrate` in the one-off `migrate` service (the first run also runs the seed scripts), starts `medusa`, waits up to 2 minutes for healthy, and rolls back on failure.
4. **Deploy storefront** (`deploy-storefront.yml`) runs on pushes touching `apps/storefront/**` or `pnpm-lock.yaml`, or by hand. It deploys the worker `azira-web` with custom domains `azira.com.au` and `www.azira.com.au`; first green run `44667060095`.

---

## 5. The first deploy (2026-11-20): what broke and how it was fixed

The steps after the SSH check had never run against the real server. Each problem only showed once the one before it was fixed. In order:

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | `The secret does not look like an SSH private key` | `DEPLOY_SSH_KEY` held other text | Set from the file with `gh secret set DEPLOY_SSH_KEY --env production < azira-deploy` (Git Bash, byte-exact) |
| 2 | `apply-env: refused: GHCR_TOKEN does not look like a GitHub token` | GitHub's 2026 token format (`ghs_` JWT, ~520 chars, dots and dashes) | `100ed2f`, and the new `apply-env.sh` installed on the server by hand (`sudo install -o root -g root -m 0755`) |
| 3 | `DB_CA_CERT_B64 does not hold a PEM certificate` | `SUPABASE_CA_CERT` held other text | Took the root ("Supabase Root 2021 CA") from the chain the database itself presents (`openssl s_client -starttls postgres -showcerts`), checked it verifies the connection (`Verify return code: 0`), set it with `gh` |
| 4 | `password authentication failed for user "postgres"` | `DATABASE_URL` still held Supabase's placeholder password | The owner entered the real password in a pop-up that tested it against the database before saving it (section 6) |
| 5 | `DATABASE_URL must be a postgres:// URL` | Windows PowerShell 5.1 writes a UTF-8 **byte-order mark** into redirected stdin, so the saved value started with an invisible character | Set `[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)` before piping; saved again |
| 6 | Database `ECONNREFUSED` from the server | Supabase **bans an IP** after a few failed password attempts (placeholder + wrong guesses + tests) | The owner removed the ban: Supabase → Database → Settings → **Network Bans** |
| 7 | Seed: `Payment providers with ids pp_stripe_stripe not found or not enabled` | Seed always attached Stripe; in preview mode Stripe isn't registered | `28b74b6` (verified locally: old seed reproduces the error, new seed completes on the half-seeded database with no duplicates; with Stripe on, the region still gets Stripe) |
| 8 | Storefront: `Hostname 'azira.com.au' already has externally managed DNS records` | Old Crazy Domains "Sitebeat" parking A records (`103.67.235.120`) for `azira.com.au` and `www` in the **Cloudflare** zone | The owner deleted those two A records in Cloudflare DNS (Crazy Domains' own DNS page is not in effect; nameservers are Cloudflare's) |

Not a problem: the storefront build and deploy print `DOQueueHandler … no such Durable Object class is exported`. That comes from wrangler's local platform proxy (used by `initOpenNextCloudflareForDev()` in `next.config.mjs` and by the R2 cache upload), which never loads the worker code. The deployed `.open-next/worker.js` does export `DOQueueHandler` (OpenNext's template), and Cloudflare accepted the `new_sqlite_classes` migration, which it refuses for a class that isn't exported.

---

## 6. Doing things from the owner's PC (what worked)

The PC has `git`, `gh` (logged in as Thisuranr, scopes repo + workflow), Git Bash, Docker Desktop and Node 24. Never print a secret; never ask the owner to paste one into the chat.

- **Setting a secret from a file:** in Git Bash, `gh secret set NAME --env production --repo Thisuranr/Jewellery-Ecom-Site < file` (byte-exact). Avoid piping from Windows PowerShell 5.1 (byte-order mark, see section 5 #5).
- **Asking the owner for a secret:** a pop-up, not the terminal (the owner found the Terminal tab hard to use). `C:\Program Files\Git\mingw64\bin\git-askpass.exe "<prompt>"` prints what was typed; capture it in a script variable and send it straight on. The DB-password script tested the value on the server (a `node` one-off in the backend image on the `azira_egress` network, with `/opt/azira/certs/supabase-ca.crt`) before saving it, and retried on a wrong password.
- **SSH as `azadmin` without retyping the passphrase:** the Windows ssh-agent service is disabled. Start Git's agent on a fixed socket (`ssh-agent -D -a /c/Users/thisu/.ssh/azira-agent.sock`, background), then `SSH_AUTH_SOCK=… SSH_ASKPASS=/mingw64/bin/git-askpass.exe SSH_ASKPASS_REQUIRE=force DISPLAY=:0 ssh-add -t 4h /c/Users/thisu/azira-admin` (the owner types the passphrase in the pop-up). Remove the key (`ssh-add -D`) and stop the agent when done.
- **Admin invite:** `cd /opt/azira/compose && sudo env IMAGE_TAG=$(sudo cat /opt/azira/current_tag) docker compose -f docker-compose.prod.yml run --rm --no-deps -T medusa /app/node_modules/.bin/medusa user -e <email> --invite`. Don't show the token; open `https://admin.azira.com.au/app/invite?token=…` in the owner's browser with `Start-Process`. If the page says "invite token is invalid" with no `?token=` in the address bar, Cloudflare Access dropped the query on its login redirect: open the link again once signed in to Access.
- **Local check of backend changes:** `docker compose up -d --wait` (Postgres 5433, Redis 6380), an `apps/backend/.env` without Stripe for preview-mode behaviour, `pnpm exec medusa db:migrate` in `apps/backend`. Deploy-script tests: `bash infra/deploy/tests/run.sh` in an `ubuntu:24.04` container (Git Bash has no `flock`).
- **Watching runs:** poll `gh run view <id> --json status,conclusion` every 20 to 60 s and `sudo tail /opt/azira/deploy.log` on the server; reply to the owner's messages between polls.

---

## 7. If a deploy fails: where to look

- **SSH exit 255:** wrong `DEPLOY_HOST` or `DEPLOY_KNOWN_HOSTS`, or the deploy key doesn't match the one baked into the server. The server has the public key from the owner's `azira-deploy.pub`. Compare with `ssh-keygen -lf $HOME\azira-deploy.pub` on the PC and `sudo ssh-keygen -lf /home/deploy/.ssh/authorized_keys` on the server.
- **Settings refused by `apply-env.sh`:** the error names the setting. Values must be single-line, with no `$ " ' \` or backticks.
- **Database:** the direct connection needs IPv6 on the Lightsail instance (dual-stack). Test on the server: `ping -6 -c1 db.jiasljnsxhelgdakjgja.supabase.co`. If IPv6 isn't on, enable IPv6 networking on the Lightsail instance (Networking tab) and allow SSH over IPv6 in its firewall, or fall back to the Supabase **session pooler** string (port 5432, never 6543) in `DATABASE_URL`. A `gin_trgm_ops` error means the extensions aren't in schema `public` (they were created there; see `docs/hosting.md` section 5 step 4).
- **Database refuses connections (`ECONNREFUSED`) though IPv6 works:** Supabase has banned the server's IP after failed password attempts. Owner: Supabase → Database → Settings → Network Bans → remove it. Test passwords sparingly.
- **Migrations fail:** the full log is `/opt/azira/logs/deploy-<time>-<sha>.log` (newest first: `sudo sh -c 'ls -t /opt/azira/logs/deploy-*.log' | head -1`). A failed migration script is re-run on the next deploy, and Medusa keeps what it made, so seed scripts must be safe to re-run.
- **Unhealthy after start:** `sudo docker compose -f /opt/azira/compose/docker-compose.prod.yml logs medusa --tail 200` (set `IMAGE_TAG` as in section 6, admin invite, if compose complains). The production check in `production-env.ts` lists every missing setting by name.
- **Tunnel:** `... logs cloudflared`. The public hostnames `api.` and `admin.` point to `http://medusa:9000`.
- Supabase **Free plan** pauses after about a week of inactivity. If the database is unreachable, check that the project isn't paused (Supabase dashboard → Restore).

---

## 8. Everything still left

Open items for the owner (they asked to be reminded):

- [x] Cloudflare **Workers Paid** US$5/month (bought 2026-11-20).
- [x] First admin user (`azirasydney@gmail.com`).
- [ ] Upload one product photo in the admin and check it shows on the shop (proves R2 and `img.azira.com.au`).
- [ ] Real shipping rates (seeded placeholders: Standard $10, Express $18) and the stock location address (placeholder Sydney).
- [ ] **Supabase Pro** US$25/month (no pausing, daily backups) before real launch.
- [ ] **Resend** account + verify `azira.com.au` + `RESEND_API_KEY` (order and password-reset emails; until then emails only go to the server log).
- [ ] **Stripe**, after the client's verification: live keys `STRIPE_API_KEY`, `NEXT_PUBLIC_STRIPE_KEY`; webhook `https://api.azira.com.au/hooks/payment/stripe_stripe` → `STRIPE_WEBHOOK_SECRET`. Then set `CHECKOUT_PAUSED=false`, redeploy both, add Stripe to the Australia region in the admin (Settings → Regions; it was seeded without a payment provider in preview mode), place a low-value test order and refund it. Afterpay/Zip later through Stripe.
- [ ] Shop inbox on azira.com.au (Cloudflare Email Routing for free, or a mailbox), then update the two inbox variables.
- [ ] `STORE_ABN` (shown on tax invoices).
- [ ] Replace the 3 sample products with the real catalogue.
- [ ] Switch on backups (`docs/hosting.md` section 8) and practise a restore.
- [ ] Lightsail automatic snapshots: optional (small extra cost). The owner asked about them; nothing is decided.

Small developer items (batch them; `CLAUDE.md` rule 6):

- [ ] Rename the workflow job "Deploy to the droplet" → "Deploy to the server", and other "droplet" wording in `.github/workflows/*.yml` and `infra/` comments. Note: editing `backend-deploy.yml` on `main` triggers a deploy.
- [ ] Remaining lint warnings (`pnpm lint`).
- [ ] Optional: copy the updated `infra/vps/bootstrap.sh` onto the server (`sudo bash infra/vps/bootstrap.sh install-files`). Not needed. (`/opt/azira/bin/apply-env.sh` on the server already matches `100ed2f`; the server's `/root/azira-infra` copy is older.)
- [ ] Next.js warns that the `middleware` file convention is deprecated (use `proxy`); migrate when convenient.
- [ ] Commit the sh-compatible Lightsail launch-script wrapper into `infra/vps/` (it was only given in chat; `docs/hosting.md` section 5 step 6 describes it).

Later product work (backend and admin first, UI polish last, per `CLAUDE.md`): the client still has to pick a design direction (`docs/research/ui-direction.md`).

---

## 9. Rules and habits to keep

- Follow `CLAUDE.md` "How we work":
  - Sort work by risk tier; Tier A (payments, prices, orders, auth, migrations) gets real review.
  - Sonnet for simple work, Opus for review and hard debugging; set `model` on every sub-agent.
  - Batch small fixes into one commit.
  - The owner's weekly Claude usage is limited, so keep things lean.
  - Rule 10: these rules beat "use big agent teams" reminders.
- **Secrets:** never ask the owner to paste a secret in chat, never print one, never commit one. Deploy secrets go in the GitHub `production` environment. GitHub push protection blocks realistic-looking keys, even fake ones in tests.
- **teacher-store:** read only.
- Commits: no AI model names in commit messages or code.
- Verify before claiming: the cloud session's lesson was "reproduce in real Docker before pushing a fix". Two guessed fixes failed before the third, verified one worked.
- Local dev: `pnpm setup:local` then `pnpm dev` (README). Admin `admin@example.com` / `jewellery-admin` locally only.
