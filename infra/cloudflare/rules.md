# Cloudflare zone settings and rules (azira.com.au)

Everything in this file is entered in the Cloudflare dashboard (by the owner, or by the lead through the API). Nothing here is applied automatically. Every step the owner does is marked **[You]**.

- **Plan:** Cloudflare Free for the zone. Limits that shape the rules (Cloudflare docs, as checked for the earlier store: re-check the limits): 5 custom rules, **1** rate limiting rule, no regular expressions in custom rules, and rate limiting expressions limited to the Path and Verified Bot fields.
- **Placeholder:** `<domain>` is `azira.com.au`.
- **Dashboard names move.** If a menu is not where this file says, use the dashboard search box with the quoted name.
- **The expressions are the contract.** Paste them exactly. (The earlier store replayed test requests against them with a lint script; it was not ported. Section 6 has the curl tests instead.)

## 1. Zone settings [You]

| Where (dashboard) | Setting | Value | Why |
|---|---|---|---|
| SSL/TLS → Overview | Encryption mode | **Full (strict)** | No proxied record points at a plain-HTTP origin. Tunnel traffic does not use this leg. |
| SSL/TLS → Edge Certificates | Always Use HTTPS | On | Standard. |
| SSL/TLS → Edge Certificates | Minimum TLS Version | **1.2** | Standard. |
| SSL/TLS → Edge Certificates | Automatic HTTPS Rewrites | On | Mixed-content safety net. |
| SSL/TLS → Edge Certificates | HSTS | **Leave off for now** | It is sticky for a year. Decide once all subdomains are settled. |
| Security → Settings (filter "Bot traffic") | **Bot Fight Mode** | **Off** | It cannot be skipped by any rule ("You cannot bypass or skip Bot Fight Mode using WAF custom rules"), so it would challenge Stripe's webhook calls and the Worker's server-side calls to `api.`. |
| Security → Settings | Security level | **Low** (never "I'm Under Attack") | Mobile carriers share addresses, and a challenge page in the middle of checkout loses sales. Medium is acceptable; Under Attack is not used. |
| Security → Settings | Browser integrity check | On (default) | The webhook skip rule exempts `/hooks/payment/stripe_stripe`. |
| Rules → Settings → **URL Normalization** | Normalize incoming URLs | **On** (default) | Rules see `/%61pp` as `/app`, `//app` as `/app` and dot segments resolved, so the admin-path block cannot be dodged by encoding. |
| Rules → Settings → **URL Normalization** | Normalize URLs to origin | **On** (default is Off) | The origin then receives the same path string the rule evaluated. Normalization type stays **RFC 3986**. |
| Caching → Tiered Cache | Smart Tiered Cache Topology | On | Free; recommended by Cloudflare for R2 custom domains. |
| Scrape Shield | Email Address Obfuscation | **Off** | Precaution (not checked in docs): it rewrites addresses in the HTML, which can disagree with what React hydrates. The footer shows a contact email. |
| Speed → Optimization | Rocket Loader | **Off** | It defers scripts and can break hydration. |
| DNS → Settings | DNSSEC | On, then add the DS record at the .com.au registrar | Optional hardening; skip it if the registrar does not support DS records. |

**Order of work:** zone settings first, then the Access application (`access.md`), then DNS routes to the tunnel (`docs/hosting.md`). Never publish `admin.<domain>` before Access exists.

## 2. WAF custom rules [You]

Dashboard: **Security → Security rules → Create rule → Custom rules**. For each rule: enter the name, choose **Edit expression**, paste the expression (one line), choose the action, **Deploy**. Afterwards drag the rules into the order below. The Free plan allows 5 custom rules; this file uses 2, and rule C1 (section 4) is held in reserve.

### Rule A: `stripe-webhook-skip` (first in the list)

Stripe's servers call `https://api.<domain>/hooks/payment/stripe_stripe`. Cloudflare must not challenge or block it. (The request is authenticated by Stripe's signature, which Medusa checks with `STRIPE_WEBHOOK_SECRET`.)

```cf-expr rule=stripe-webhook-skip
http.host eq "api.<domain>" and http.request.uri.path eq "/hooks/payment/stripe_stripe"
```

- **Action:** Skip.
- **WAF components to skip:** All remaining custom rules, All rate limiting rules, All managed rules.
- **More components to skip:** Browser Integrity Check, Security Level.
- **Log matching requests:** On (so Security → Events shows Stripe's calls).
- Bot Fight Mode cannot be skipped. That is why section 1 sets it to Off.

### Rule B: `block-admin-paths-on-api`

The admin dashboard and the staff auth routes live on `admin.<domain>` only. On the API host they are blocked. Medusa's router ignores letter case, so the path is lower-cased before it is compared; matching is by prefix, so `/app/x`, `/admin/users/me` and `/auth/user/emailpass` are all covered.

```cf-expr rule=block-admin-paths-on-api
http.host eq "api.<domain>" and (starts_with(lower(http.request.uri.path), "/app") or starts_with(lower(http.request.uri.path), "/admin") or starts_with(lower(http.request.uri.path), "/auth/user") or starts_with(lower(http.request.uri.path), "/auth/session"))
```

- **Action:** Block.
- The storefront signs customers in through `/auth/customer/...` and keeps a JWT, so nothing legitimate on `api.` uses the blocked paths. If the storefront ever switches to session auth, revisit rule B first.
- The admin dashboard at `admin.<domain>` reaches `/admin/...` and `/auth/user/...` on its own host, which is not affected.

## 3. Rate limiting rule (the one free rule) [You]

Dashboard: **Security → Security rules → Create rule → Rate limiting rules**.

```cf-expr rule=account-flood-guard
http.request.uri.path contains "/account"
```

- **Name:** `account-flood-guard`.
- **Expression:** the line above, built with the builder as Field **URI Path**, Operator **contains**, Value `/account`. The Free plan offers only the Path and Verified Bot fields, so the plan's `http.host eq "www.<domain>"` clause cannot be used. No Medusa route on `api.` or `admin.` contains `/account`, so nothing else is counted.
- **Characteristics:** IP (the only Free option). **Requests:** 20 **per** 10 seconds (the only Free period).
- **Action:** Block. **Duration:** 10 seconds (the only Free value).
- **What it is:** a flood guard for the account pages, not brute-force protection. Sign-in brute-force protection is a separate job.

## 4. Contingency rule C1 (create only if the trigger happens)

**Trigger (check after the first deploy):** server-side calls from the Worker to `https://api.<domain>/store/...` fail with a Cloudflare challenge or block page (a `cf-mitigated` header, or an HTML body in the Worker log). Workers send requests without a browser's headers, and Browser Integrity Check can object to that.

```cf-expr rule=store-api-skip-bic
http.host eq "api.<domain>" and starts_with(http.request.uri.path, "/store/")
```

- **Action:** Skip. **More components to skip:** Browser Integrity Check, Security Level. Place it after rule A.
- The store API is public by design (publishable key), so skipping the integrity check there costs nothing. Do not create it before the trigger is seen.

## 5. Image host: cache rule and transformations [You]

1. **Images → Transformations:** select the zone and **enable transformations** for it. Sources stay at the default (same zone only); `img.<domain>` is in the zone. The free allowance is 5,000 unique transformations a month; the storefront loader uses four widths to stay far below it .
2. **Caching → Cache Rules → Create rule:** name `img-long-edge-ttl`.
   - **When incoming requests match:** Custom filter expression `http.host eq "img.<domain>"`.
   - **Then:** Cache eligibility **Eligible for cache**; Edge TTL **Ignore cache-control header and use this TTL → 1 month**; Browser TTL **Override origin and use this TTL → 7 days**.
   - Object names are unique per upload (the S3 file provider prefixes a generated id), so a long edge TTL is safe. If a file is ever replaced under the same name, purge it: **Caching → Configuration → Purge Cache → Custom Purge**.
3. The `img.<domain>` hostname itself is created by R2 (`r2.md`).

```cf-expr rule=img-long-edge-ttl
http.host eq "img.<domain>"
```

## 6. Test everything [You]

Run from your own PC (Git Bash, or PowerShell with `curl.exe`). `D` is the real domain. `--path-as-is` stops curl from tidying the path before Cloudflare sees it.

```bash
D=azira.com.au
# Rule B: every line must print 403
for p in /app /app/ /App /APP/login /admin /admin/users/me /Admin/users \
         /auth/user/emailpass /auth/session /auth/mfa/factors /AUTH/MFA/x \
         /%61pp /%41dmin /./app //app /store/../app; do
  printf '%-26s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' --path-as-is "https://api.$D$p"
done
# Must NOT be blocked by Cloudflare:
curl -s -o /dev/null -w 'health        %{http_code}  (want 200)\n' "https://api.$D/health"
curl -s -o /dev/null -w 'auth/customer %{http_code}  (want 404 from Medusa, not a block page)\n' "https://api.$D/auth/customer/emailpass"
curl -s -D - -o /dev/null -X POST "https://api.$D/hooks/payment/stripe_stripe" | grep -i -E '^(HTTP|server|cf-mitigated)'
#   want an answer from Medusa (400 without a Stripe signature) and no cf-mitigated header
# Access gate (access.md): want 302 and a Location on cloudflareaccess.com
curl -s -I "https://admin.$D/app" | grep -i -E '^(HTTP|location)'
curl -s -I "https://admin.$D/admin/users/me" | grep -i -E '^(HTTP|location)'
# Rate limit: the first ~20 answer normally, the rest 429
for i in $(seq 1 30); do curl -s -o /dev/null -w '%{http_code} ' "https://www.$D/au/account"; done; echo
```

Then open **Security → Events** and check that the blocked requests show rule B and that a Stripe test webhook (Stripe dashboard > Webhooks > Send test event) shows a **Skip** event for rule A and no challenge.

## 7. Notes for the reviewer

- **Why `lower(...)` and prefix matching:** Medusa runs on Express, which matches routes without regard to case, so `/ADMIN/users` reaches the admin API. `starts_with` over-matches harmlessly (`/application` is not a Medusa route); an exact match would leave gaps.
- **Why normalization matters:** the rule sees the normalized path only when "Normalize incoming URLs" is on. Cloudflare leaves reserved characters alone, so `/%2Fadmin` stays as written; Express does not decode a path before matching routes, so it does not reach `/admin`.
- **Why rule A is first and skips "All remaining custom rules":** rule B cannot match the webhook path, so skipping it costs nothing and stops any future broad rule from catching Stripe.
- **A false block:** do not add ad-hoc exceptions in the dashboard. Change the expression in the dashboard and in this file together, so the file stays the single source of truth.
- **Sources (Cloudflare docs, as read for the earlier store):** Rules language functions (`starts_with`, `lower`), operators (`in {a b}` with space separators, `not`, precedence), values (IPv4 and IPv6 CIDR inside inline lists), URL normalization settings, WAF skip options, Bot Fight Mode, rate limiting availability table, custom rules availability table.
