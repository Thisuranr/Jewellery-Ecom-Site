# Azira hosting guide (for the owner)

This is the plain-English guide to where Azira runs, what you must paste into GitHub, and what to do if something goes wrong. You do not need to be technical. You never edit a file on the server: every setting lives in GitHub, and a button press ("Run workflow") puts it on the server.

Who does what: **you** (the owner) create the accounts, paste secrets into GitHub and press buttons. **The lead** (the developer you are working with) creates the server, the Cloudflare settings and the first deploy, using the files in this repository.

## Before launch (real sales)

The site can go live **before** Stripe and Resend exist, in **preview mode** (see "Preview mode" below): visitors can browse, and the bag and checkout say "Online payments open soon". Before the shop takes real money, all of these must be true:

- [ ] **Stripe:** the account is verified (business details, bank account), the **live** keys are in (`STRIPE_API_KEY`, `NEXT_PUBLIC_STRIPE_KEY`), the live webhook endpoint exists and its signing secret is in `STRIPE_WEBHOOK_SECRET`. Then set the repository variable `CHECKOUT_PAUSED` to `false` and run **Backend deploy** and **Deploy storefront**. Place a low-value test order and refund it.
- [ ] **Resend:** the account exists, the domain `azira.com.au` is verified, `RESEND_API_KEY` is set. (The backend then sends order emails with `EMAIL_TRANSPORT=resend`; the deploy workflow does this by itself whenever `RESEND_API_KEY` is set.)
- [ ] **Supabase Pro** (US$25 a month) so the database never pauses and has daily backups. The Free plan pauses after a week of inactivity.
- [ ] **Cloudflare Workers Paid** (US$5 a month). It is needed **before the first storefront deploy** (R2 caches, D1, Durable Objects).
- [ ] **Real contact details:** the variables `STORE_NOTIFY_EMAIL`, `CUSTOM_ORDER_EMAIL` and `STORE_ABN` hold real values (not test inboxes).
- [ ] **Delete or replace the 3 Sample products** with the real catalogue, prices and photos.
- [ ] **First login:** confirm the admin sign-in works through the tunnel at `https://admin.azira.com.au/app` (the session cookie needs `X-Forwarded-Proto: https`, which the tunnel sends; if the login loops, check that header first).
- [ ] **Cloudflare Access** protects `admin.azira.com.au` (it is mandatory, not only before launch: see section 5 step 7).
- [ ] Backups are switched on and a restore has been practised (section 8).

## Preview mode ("payments paused")

`CHECKOUT_PAUSED` is a GitHub **variable** (Settings, Secrets and variables, Actions, Variables). **If it is not set, it counts as `true`.** While it is `true`:

- The backend starts without Stripe keys and with email set to `console` (messages are written to the server log, nothing is sent) if no `RESEND_API_KEY` is set. Everything else stays required. The backend logs a warning at every start.
- The backend itself refuses to complete a cart or open a payment session (HTTP 403, "online payments are not open yet"), so nobody can order even by calling the API directly.
- The storefront bag, and the checkout page, show "Online payments open soon. Have something in mind? Contact us" with a link to the custom-order form, instead of the checkout.
- `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_KEY` and `RESEND_API_KEY` are not needed.

To open for real sales, work through "Before launch" above, set `CHECKOUT_PAUSED` to `false`, then run **Backend deploy** and **Deploy storefront** (the storefront bakes the flag in at build time, so it must be rebuilt). With `false`, the backend and the deploy refuse to start without Stripe and Resend.

## 1. What runs where

```
                      Customers' browsers
                              |
        +---------------------+-----------------------+
        |                     |                       |
 azira.com.au          img.azira.com.au      api.azira.com.au  admin.azira.com.au
 www.azira.com.au      (product photos)      (store API, logins,  (staff dashboard,
 STOREFRONT            Cloudflare R2         Stripe webhooks)      always behind
 Cloudflare Workers    bucket azira-images        |                Cloudflare Access)
        |                                         |                      |
        +---- calls the store API ----------------+----------------------+
                                                  |
                                    Cloudflare Tunnel (outbound only)
                                                  |
                       +--------------------------+---------------------------+
                       | DigitalOcean droplet, Sydney (SYD1), Ubuntu 24.04, 2 GB |
                       |  Docker Compose:                                       |
                       |    medusa      store API + admin + jobs (one process)   |
                       |    redis       sessions, queues, locks (not public)     |
                       |    cloudflared the tunnel (no open ports on the server) |
                       +--------------------------+---------------------------+
                                                  |
             +------------------+-----------------+-----------------+-----------+
             |                  |                                   |           |
     Supabase Postgres    Cloudflare R2                          Stripe       Resend
     Sydney (database,    (uploads: azira-images;                (payments)   (email from
     verified TLS)         backups: azira-db-backups;                          orders@azira.com.au)
                           storefront cache: azira-next-cache + D1 azira-tag-cache)

 GitHub Actions: builds the backend image (to GHCR), deploys it over SSH to the droplet,
                 and deploys the storefront to Cloudflare Workers.
```

Nothing on the droplet is open to the internet except SSH (key only). Customers and staff reach the backend only through the Cloudflare Tunnel.

## 2. How a deploy works (so you can trust it)

1. You (or a developer) merge a change into the `main` branch on GitHub.
2. GitHub builds the backend into an image and stores it in GitHub's registry (GHCR), named after the exact commit.
3. GitHub connects to the droplet with a **restricted key** (user `deploy`). That key can do only two things: send the settings, and ask for a deploy of a named commit. It cannot open a shell, run Docker, or copy files. The server is also **pinned to one image**: `/opt/azira/image-pin.env` (owned by root, written when the server is first set up) names `ghcr.io/thisuranr/azira-backend` and the registry user `thisuranr`, and both the settings checker and the deploy program refuse any other image or user. So even a stolen deploy key cannot make the server run somebody else's image.
4. **The settings.** GitHub builds the server's settings file from your GitHub secrets and sends it. A small program on the droplet (`apply-env.sh`) checks every name against an allow-list and every value for dangerous characters, and only then writes the files (`/opt/azira/.env`, readable by root only), all at once. If anything looks wrong it writes nothing and the deploy stops with a message naming the setting.
5. **The deploy.** The droplet pulls the image, updates the database, starts the new version and waits up to two minutes for it to report healthy. If it does not, it puts the previous version back automatically. If you changed `REDIS_PASSWORD` or `TUNNEL_TOKEN`, the deploy also recreates the Redis or tunnel container so it picks up the new value (a few seconds of interruption).
6. The storefront is separate: a push that changes `apps/storefront` rebuilds it and publishes it to Cloudflare Workers.

Deploys run on every push to `main` that touches the backend (or the storefront, for the storefront) and when you press **Run workflow**. They run **only for `main`**: pressing Run workflow on another branch builds and deploys nothing (the jobs are skipped, and GitHub would not release the production secrets to another branch anyway). A sha you type in the **sha** box must be a commit on `main`. Checks (tests, build) run on pull requests to `main`.

### The GitHub environment `production` (do this once, before the first deploy)

The production secrets live in a GitHub **environment** named `production`, not at repository level, so only the `main` branch can read them.

1. GitHub, your repository, **Settings, Environments, New environment**, name it exactly `production`.
2. Under **Deployment branches and tags** choose **Selected branches and tags**, **Add deployment branch or tag rule**, type `main`. (Optional: tick **Required reviewers** and add yourself; then every deploy waits for your approval click. Leave it off if you want deploys to run by themselves.)
3. In the same environment, under **Environment secrets**, add every secret from the table below.
4. **Move the three secrets you already created at repository level**: `DEPLOY_SSH_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Add each to the `production` environment (paste the value again; GitHub never shows a secret after saving), then **delete the repository-level copies** (Settings, Secrets and variables, Actions, Repository secrets, the bin icon). A copy left at repository level can be read by any branch's workflow.
5. Variables (the second table) can stay at repository level; they are not secret.

## 3. Every GitHub secret and variable

GitHub: **secrets go into the `production` environment** (Settings, Environments, `production`, **Add environment secret**; see the box above). Variables are on **Settings, Secrets and variables, Actions, Variables**. Paste values exactly, with no quotes and no spaces around them.

**Rules for values.** The settings travel as one line each, so: no line breaks (except the certificate, which is handled), and no `$ " ' \` or backtick characters, no space at the start or end. Random secrets made with the commands in section 4 are always fine.

### Secrets

| Secret name | What to paste | Where to find it |
|---|---|---|
| `DEPLOY_SSH_KEY` | The **private** deploy key (the whole file, including the `-----BEGIN` and `-----END` lines) | You make it on your PC, section 4 step 1. **If you already created it as a repository secret, move it into the `production` environment and delete the repository copy** |
| `DEPLOY_HOST` | The droplet's IPv4 address, for example `203.0.113.10` | The lead sends it after creating the droplet |
| `DEPLOY_KNOWN_HOSTS` | One line proving it is really your droplet: `203.0.113.10 ssh-ed25519 AAAA...` | The lead runs `ssh-keyscan -t ed25519 <ip>` against the new droplet (and checks it against DigitalOcean's console) and sends you the line |
| `DATABASE_URL` | The Supabase **direct connection** string over IPv6, with your database password filled in (percent-encode symbols; letters and digits need nothing) | Supabase, your project, **Connect, Direct connection** (port **5432**). Looks like `postgresql://postgres:<password>@db.jiasljnsxhelgdakjgja.supabase.co:5432/postgres`. Add nothing after `/postgres`. The direct connection needs the droplet to have IPv6 (see section 5 step 6). Direct is used because the session pooler's limit (about 15 connections) is reached during a deploy (app plus migration). Fallback only if IPv6 is not available: the Session pooler string (port 5432, never 6543) |
| `SUPABASE_CA_CERT` | The text of Supabase's certificate file (several lines is fine here) | Supabase, **Project Settings, Database, SSL Configuration, Download certificate**. Open the downloaded `.crt` file in Notepad, copy everything including the `BEGIN CERTIFICATE` and `END CERTIFICATE` lines |
| `REDIS_PASSWORD` | A random password of **letters and digits only**, 24 to 128 characters | Make one, section 4 step 2 |
| `JWT_SECRET` | A random value, at least 32 characters (64 hex characters is ideal) | Make one, section 4 step 2 |
| `COOKIE_SECRET` | Another, different random value of the same kind | Make one, section 4 step 2 |
| `STRIPE_API_KEY` | **Not needed in preview mode.** The **live** secret key, starts `sk_live_` (or a restricted key `rk_live_`) | Stripe dashboard, **Developers, API keys**. A `sk_test_` key works for a dress rehearsal, but the placeholder `sk_test_placeholder` is refused |
| `STRIPE_WEBHOOK_SECRET` | **Not needed in preview mode.** The signing secret, starts `whsec_` | Stripe, **Developers, Webhooks, Add endpoint**: URL `https://api.azira.com.au/hooks/payment/stripe_stripe`, events `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`, `payment_intent.payment_failed` (check Medusa's Stripe page if Stripe renames them). After saving, click **Reveal** under Signing secret |
| `NEXT_PUBLIC_STRIPE_KEY` | **Not needed in preview mode.** The **publishable** key, starts `pk_live_` | Stripe, **Developers, API keys** |
| `R2_ACCESS_KEY_ID` | The R2 access key for the images bucket | **Already created: move it from the repository secrets into the `production` environment.** Cloudflare, **R2, Manage API tokens** (token `azira-files-rw`, see `infra/cloudflare/r2.md`) |
| `R2_SECRET_ACCESS_KEY` | Its secret | **Already created: move it too.** Shown once when the token is made |
| `RESEND_API_KEY` | **Not needed in preview mode** (emails are then only logged). The Resend API key, starts `re_` | Resend, **API Keys, Create API Key** (permission: sending). First add and verify the domain `azira.com.au` under **Domains** (Resend shows DNS records to add in Cloudflare) |
| `TUNNEL_TOKEN` | The Cloudflare Tunnel token (a long text starting `eyJ`) | The lead creates the tunnel (Cloudflare, **Zero Trust, Networks, Tunnels**) and sends the token, or you copy it from the tunnel's install command |
| `CLOUDFLARE_API_TOKEN` | A Cloudflare API token that may deploy Workers, R2 and D1 | Cloudflare, **My Profile, API Tokens, Create Token**, template **Edit Cloudflare Workers**, then add **Account, D1, Edit** and **Account, Workers R2 Storage, Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Cloudflare dashboard, **Workers & Pages**, right-hand side (the long hex code; it is the same code at the start of the R2 address) |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | The store's publishable key, starts `pk_` | The admin dashboard, **Settings, Publishable API Keys**. It exists only after the first backend deploy and your first admin login (first deploy order, section 5) |

### Variables

`STORE_NOTIFY_EMAIL` and `CUSTOM_ORDER_EMAIL` are required; `CHECKOUT_PAUSED` decides preview mode; the rest already default to the real Azira values and are listed so you know they exist.

| Variable name | What to paste |
|---|---|
| `STORE_NOTIFY_EMAIL` | **Required.** The inbox that gets a "new order" email for every order |
| `CUSTOM_ORDER_EMAIL` | **Required.** The inbox that gets custom-order enquiries from the website form |
| `CHECKOUT_PAUSED` | `true` or `false`. **Default `true`** (preview mode, section "Preview mode" above). Set to `false` only when Stripe and Resend are ready |
| `STORE_ABN` | Optional. Your ABN, printed on the order confirmation (tax invoice) |
| `EMAIL_FROM` | Default `Azira <orders@azira.com.au>` |
| `EMAIL_REPLY_TO` | Optional. Where customer replies go |
| `ADMIN_URL` | Default `https://admin.azira.com.au`. It is built into the admin screens, so change it only with the lead |
| `STOREFRONT_URL`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `FILE_URL`, `R2_ENDPOINT`, `R2_BUCKET` | Defaults are the right Azira values (R2 endpoint `https://7b7865326875e0dea1285c31309d77a4.r2.cloudflarestorage.com`, bucket `azira-images`, files `https://img.azira.com.au`) |
| `API_URL`, `BASE_URL`, `IMAGE_HOST`, `STORE_NAME`, `DEFAULT_REGION` | Storefront build settings. Defaults: `https://api.azira.com.au`, `https://azira.com.au`, `img.azira.com.au`, `Azira`, `au` |

If a required secret or variable is missing, the deploy stops straight away and lists exactly which ones.

## 4. Things you do on your own PC

Use PowerShell (Start menu, type PowerShell). Nothing here needs admin rights.

**Step 1: the deploy key (so GitHub can deploy).**

```powershell
mkdir $env:USERPROFILE\.ssh -Force
ssh-keygen -t ed25519 -C "azira-github-deploy" -f $env:USERPROFILE\.ssh\azira_deploy -N '""'
```

(If it asks for a passphrase, press Enter twice: the key must have none, because GitHub cannot type one.) This makes two files:

- `azira_deploy.pub` is the **public** half. Show it and send it to the lead in chat: `Get-Content $env:USERPROFILE\.ssh\azira_deploy.pub`
- `azira_deploy` is the **private** half. Never send it to anyone. Copy it into the GitHub secret `DEPLOY_SSH_KEY`: `Get-Content $env:USERPROFILE\.ssh\azira_deploy -Raw | Set-Clipboard`, then paste into GitHub. Keep a copy in your password manager.

**Optional: your own login key**, if you want to log in to the server yourself (the lead has their own). Same command with `-f ...\azira_admin` and a passphrase of your choice; send only the `.pub` to the lead.

**Step 2: make random secrets** (run once per secret; each prints a new value):

```powershell
# 64 hex characters: for JWT_SECRET and COOKIE_SECRET
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
# letters and digits only, 40 characters: for REDIS_PASSWORD
$c = [char[]]((48..57) + (65..90) + (97..122)); $b = New-Object byte[] 40; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { $c[$_ % $c.Length] })
```

Paste each straight into GitHub. Do not keep them in a file or send them in chat.

## 5. First deploy order

Follow these in order. Steps marked **(lead)** are done by the developer.

1. **Accounts with two-step sign-in on:** GitHub, Cloudflare, DigitalOcean, Supabase, Stripe, Resend, and the domain registrar. Use a password manager.
2. **(lead)** `azira.com.au` is on Cloudflare (nameservers changed at the registrar). **Workers Paid** plan is on (about USD 5 a month): it is needed before the first storefront deploy (R2 caches, D1, Durable Objects).
3. **(lead)** Cloudflare: R2 buckets `azira-images`, `azira-next-cache`, `azira-db-backups`; `img.azira.com.au` connected to `azira-images`; zone settings and rules from `infra/cloudflare/rules.md`; image transformations on. See `infra/cloudflare/r2.md`.
4. **Supabase:** create the project in **Sydney (ap-southeast-2)**. Then open **SQL Editor** and run these two lines once (the store's search needs them; the backend also tries to create them, but Supabase may not allow that for the app's user):
   ```sql
   create extension if not exists pg_trgm with schema public;
   create extension if not exists unaccent with schema public;
   ```
   The extensions **must be in the schema `public`** (the lines above say so). Do not use the Database, Extensions screen: it puts them in a schema called `extensions`, and that does NOT work, because Medusa pins its search path to `public` and the migration then fails with `operator class "gin_trgm_ops" does not exist`. (Already done on the live project.) Then fill the secrets `DATABASE_URL` and `SUPABASE_CA_CERT`.
5. **You:** create the GitHub environment `production` (section 2, box). Make the deploy key (section 4 step 1) and send the **public** half to the lead. Put the private half in `DEPLOY_SSH_KEY` as a secret **of the `production` environment**. (If you created `DEPLOY_SSH_KEY`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` as repository secrets earlier, move them into the environment and delete the repository copies.)
6. **(lead)** Creates the DigitalOcean droplet in **Sydney (SYD1)**, Ubuntu 24.04, **with IPv6 enabled** (needed for the direct database connection), size `s-1vcpu-2gb-amd` (Premium AMD, 1 vCPU, 2 GB; the only 2 GB size Sydney offers, about US$14 a month), with the first-boot script from `infra/vps/make-user-data.sh` (your public deploy key goes in it, and so does the image pin: `BACKEND_IMAGE_REPO=ghcr.io/thisuranr/azira-backend`, `GHCR_OWNER=thisuranr`, the defaults), a firewall that allows only SSH in, and monitoring on. About five minutes later the server is hardened and Docker is installed. The lead sends you the droplet IP (`DEPLOY_HOST`) and the host-key line (`DEPLOY_KNOWN_HOSTS`).
7. **(lead)** Creates the Cloudflare Tunnel with two public hostnames, `api.azira.com.au` and `admin.azira.com.au`, both pointing at `http://medusa:9000` (see `infra/cloudflare/tunnel-config.yml`), and sends the token for `TUNNEL_TOKEN`. **Mandatory:** protect `admin.azira.com.au` with Cloudflare Access (`infra/cloudflare/access.md`) **before** the hostname goes live. The lead sets it up; the admin must never be reachable with only its own login page in front of it. `infra/cloudflare/rules.md` also rate-limits the admin login.
8. **You:** fill in every remaining secret (in the `production` environment) and variable from section 3 except `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` and (until the storefront step) the Cloudflare ones.
9. **Run the first backend deploy:** GitHub, **Actions, Backend deploy, Run workflow**. It builds the image (several minutes the first time), sends the settings and starts everything. A green run means the new version passed its health check. Check `https://api.azira.com.au/health` says OK.
10. **Create the first admin user.** The lead runs one command on the server (`docker compose ... run --rm medusa npx medusa user -e <email> -p <password>`; the lead knows it). Then sign in at `https://admin.azira.com.au/app`. Cloudflare Access asks for an emailed code first, then the admin's own login.
11. In the admin: **Settings, Publishable API Keys**: copy the key into the secret `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`. Upload one product photo and check it shows (that proves R2 works). Set up the region, shipping and (when Stripe exists) the Stripe payment provider as the lead directs.
12. The Cloudflare D1 database for the storefront cache (`azira-tag-cache`) already exists and its id is committed in `apps/storefront/wrangler.jsonc`. Fill in `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (and `NEXT_PUBLIC_STRIPE_KEY` once Stripe exists; not needed in preview mode).
13. **Deploy the storefront:** **Actions, Deploy storefront, Run workflow.** Then open `https://azira.com.au`. Cloudflare creates the DNS records for `azira.com.au` and `www.azira.com.au` itself (the names must not already exist in DNS as something else). The storefront itself redirects `www.azira.com.au/*` to `https://azira.com.au/*` (301).
14. **Only when Stripe is ready (see "Before launch"):** set `CHECKOUT_PAUSED` to `false`, redeploy both, then **test a real order** with a low-value product and your own card, then refund it from the admin (order page). Stripe's webhook must show deliveries with status 200 (Stripe, Developers, Webhooks). In preview mode, check instead that the bag shows "Online payments open soon" and that `POST https://api.azira.com.au/store/carts/<id>/complete` answers 403.
15. Turn on backups (section 8).

## 6. Rolling back

**Backend (a bad release).** The deploy rolls back by itself if the new version is not healthy within two minutes. If a release is healthy but wrong:

1. GitHub, **Code, Commits**: find the last commit that was good and copy its full 40-character code (the copy button next to the commit).
2. **Actions, Backend deploy, Run workflow**, paste it in the **sha** box, **Run workflow**. This skips the build and deploys that older image (it must still be in the registry and must be a commit on `main`).

Important: database changes are **not** undone by a rollback. Developers write database changes so the previous version still works with them, but if a bad release changed or deleted data, ask the lead before rolling back, and remember backups exist (section 8). Roll-back history is on the droplet in `/opt/azira/deploy.log`.

**Storefront.** Cloudflare, **Workers & Pages, azira-web, Deployments**: pick the previous version and choose **Rollback**. Or run **Deploy storefront** after reverting the change in GitHub.

**If the roll-back itself fails** (the run ends red with "ROLLBACK FAILED"), the store API is down: tell the lead straight away. The log is `/opt/azira/logs/` on the server.

## 7. Routine care

- **Changing a secret** (for example a new Stripe key): update the GitHub secret (in the `production` environment), then run **Backend deploy** again. It rewrites the server's settings and restarts the backend. This includes `REDIS_PASSWORD` and `TUNNEL_TOKEN`: the deploy notices that the Redis or tunnel settings changed (it keeps a fingerprint of them in `/opt/azira/service-env.sha256`) and recreates that container before starting the new backend, so nothing is left running with the old value. Expect a short interruption of a few seconds to a few minutes while the old backend has no Redis; the new one starts right after.
- **Changing the pinned image or registry user** (only if the repository moves to another owner): the lead sets `BACKEND_IMAGE_REPO` and `GHCR_OWNER` and re-runs `sudo bash infra/vps/bootstrap.sh install-files` on the server. A deploy cannot change them.
- **Changing server files** (`infra/deploy/`, the compose file, backup scripts): these are installed on the server once by the first-boot script and are root-owned on purpose, so a normal deploy never changes them. After such a change the lead copies the `infra` folder to the server and runs `sudo bash infra/vps/bootstrap.sh install-files`.
- **Server updates:** security updates install by themselves. The server reboots at 04:00 Sydney time only when an update needs it, and the containers come back by themselves. Once a month the lead runs `sudo apt update && sudo apt full-upgrade` for the rest (Docker is not auto-updated).
- **Rebuilding the server:** the droplet holds no data that is not in Supabase, R2 or GitHub. A new droplet from the same first-boot script plus **Run workflow, Backend deploy** brings everything back. Update `DEPLOY_HOST` and `DEPLOY_KNOWN_HOSTS`, and any Cloudflare or Supabase allow-lists that name the droplet's address.
- **If you lose SSH access:** DigitalOcean, the droplet, **Access, Launch Droplet Console** (recovery console), or ask the lead.

## 8. Backups

Backups are **installed but switched off** until you choose to enable them, because they need two things only you can provide.

What they do: every 6 hours the server dumps the database, encrypts it with a public key (**age**) and uploads it to the private R2 bucket `azira-db-backups`. The matching private key never goes on the server, so a stolen server or bucket cannot read the backups. A bucket rule deletes backups after 35 days (`infra/cloudflare/r2.md`).

To enable (about 20 minutes, with the lead):

1. **Make the key pair on your PC.** Install `age` (https://github.com/FiloSottile/age/releases, the Windows zip), then `age-keygen -o azira-backup-key.txt`. It prints `Public key: age1...`. Keep `azira-backup-key.txt` **offline** (password manager attachment plus a USB stick). Without it a backup cannot be opened. Send only the `age1...` public key to the lead.
2. **R2 token for backups:** a token limited to the `azira-db-backups` bucket (`infra/cloudflare/r2.md`, token `azira-backups-rw`).
3. **The lead** creates `/opt/azira/backup.env` on the server (root only, mode 0600) from `infra/backup/backup.env.example`: the Supabase direct-connection host (`db.jiasljnsxhelgdakjgja.supabase.co`) and user `postgres`, the database password, the age public key, the R2 token, and a monitoring ping address if you have one. This is the one file that is not written by the deploy, because the backup key and token are not needed to run the store.
4. `sudo systemctl start azira-backup.service` for a first run, check `journalctl -u azira-backup` and that a file appeared in the bucket, then `sudo systemctl enable --now azira-backup.timer`.
5. **Practise a restore** into a scratch database before you need one: `/opt/azira/bin/restore.sh` (see its header; it refuses to write over a real database).

## 9. What it costs each month

Rough, in Australian dollars at an assumed USD 1 = AUD 1.50; prices change, so check each provider.

| Item | USD | AUD (approx.) |
|---|---|---|
| DigitalOcean droplet, Premium AMD 2 GB, `s-1vcpu-2gb-amd` (Sydney) | 14 | 21 |
| Supabase **Pro** (recommended: daily backups, no pausing) | 25 | 38 |
| Cloudflare Workers Paid (storefront, R2 caches, D1) | 5 | 8 |
| Cloudflare R2 storage (first 10 GB free, then 1.5 cents per GB) | 0 to 2 | 0 to 3 |
| Resend (free up to 3,000 emails a month; Pro if you outgrow it) | 0 (or 20) | 0 (or 30) |
| GitHub Actions (free allowance is plenty for this use) | 0 | 0 |
| Cloudflare (DNS, Tunnel, Access for up to 50 staff, Image Transformations up to 5,000 a month) | 0 | 0 |
| **Total** | **about 44 to 66** | **about 66 to 99** |

Other costs: the `azira.com.au` domain (about AUD 15 to 25 a year, paid to the registrar); Stripe takes a fee per payment (check Stripe's current Australian pricing; there is no monthly fee). Running on Supabase **Free** would save about AUD 38 a month, but that plan pauses a project after a week of inactivity and has no backups you can restore from, so it is not suitable for a live shop.

## 10. What is checked by the repository (and what is not)

The repository's tests prove the deploy gate refuses anything but the three allowed requests, the settings checker refuses bad or unknown settings, the first-boot script is idempotent in a dry run, the backup and restore scripts work against stand-ins, and the backend refuses to start in production when a required setting is missing or still a placeholder. What cannot be proven without the real accounts: that Docker really starts the stack, that the Cloudflare Tunnel and rules behave as written, the Stripe webhook, Resend delivery, and the real droplet's hardening report (`sudo bash infra/vps/bootstrap.sh check` on the droplet prints it; every line must say `ok`). Treat the first deploy as the real test.
