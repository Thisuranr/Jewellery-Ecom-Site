# Cloudflare Access for the admin host (optional, recommended)

`admin.azira.com.au` is a second hostname on the same tunnel as `api.azira.com.au`. One Access application covers the **whole host**, so a forgotten path cannot bypass it. Staff then meet Medusa's own email-and-password login behind it, which makes two gates: Access one-time PIN, then Medusa. **This step is optional**: the store works without it, protected by Medusa's login alone. It is recommended because the admin dashboard can change prices and refund orders. Without Access, `https://admin.azira.com.au/app` is open to the whole internet (behind Medusa's login).

- **Who:** the staff email list only. Policy action **Allow**; there is **no Bypass policy and no Service Auth policy**, and none may be added (a bypass disables Access and its requests are not logged).
- **Login method:** one-time PIN (an emailed 6-digit code, valid 10 minutes, single use).
- **Session:** 24 hours.
- **Plan:** Zero Trust Free (up to 50 users). If the sign-up asks for a payment method, choose the Free plan; it is not charged. Not checked here.
- **Dashboard names move.** If a menu is not where this file says, use the dashboard search box with the quoted name. Cloudflare's current path is **Zero Trust → Access controls → Applications**.

## Steps [You]

Do these before `admin.azira.com.au` is routed to the tunnel (`docs/hosting.md`). Cloudflare says to create the application first so the route is never reachable without access controls.

1. **Open Zero Trust.** Cloudflare dashboard → **Zero Trust**. The first time, choose a team name (it becomes `<team>.cloudflareaccess.com`) and the **Free** plan.
2. **Turn on one-time PIN.** One-time PIN is *not* added automatically for new organizations. **Zero Trust → Integrations → Identity providers → Add new identity provider → One-time PIN → Save**.
3. **Set the global session length.** **Zero Trust → Settings → Authentication → Global session timeout → 24 hours.** Cloudflare recommends it be equal to or longer than the application session, so staff are not asked twice.
4. **Create the policy.** **Zero Trust → Access controls → Policies → Add a policy.**
   - Policy name: `azira-staff`. Action: **Allow**. Session duration: 24 hours.
   - Add a rule under **Include**: selector **Emails**, then add each address: `<owner email>`, `<staff email 1>`, `<staff email 2>`, one at a time. Do **not** use "Emails ending in" (it would let in anyone at a shared domain such as outlook.com or gmail.com).
   - Save. Only the people listed get a PIN email (an unlisted address is told "a code has been emailed" but receives nothing).
5. **Create the application.** **Zero Trust → Access controls → Applications → Create new application → Self-hosted and private.**
   - Application name: `Azira admin`.
   - **Add public hostname:** Subdomain `admin`, Domain `azira.com.au`, **Path left empty** (empty means the entire host). Do not add `api.azira.com.au` here.
   - **Access policies:** select `azira-staff`.
   - **Login methods:** enable **One-time PIN** only; turn on **Apply instant authentication** (there is only one method).
   - **Session Duration:** **24 hours**.
   - Leave *Additional settings* (CORS, cookies, custom pages) at their defaults. The admin dashboard calls its own host, so no CORS is needed.
   - **Create.**
6. **Check the list.** The application must show one hostname, `admin.azira.com.au`, one policy, `azira-staff`.

## After the tunnel route exists [You]

From your PC (PowerShell: use `curl.exe`; Git Bash works too), with `D` set to the real domain:

```bash
D=azira.com.au
curl -s -I "https://admin.$D/"           | grep -i -E '^(HTTP|location)'
curl -s -I "https://admin.$D/app"        | grep -i -E '^(HTTP|location)'
curl -s -I "https://admin.$D/admin/users/me" | grep -i -E '^(HTTP|location)'
curl -s -I "https://admin.$D/health"     | grep -i -E '^(HTTP|location)'
```

Every line must be `HTTP/2 302` with a `location:` on `<team>.cloudflareaccess.com`. **Any `200` or a Medusa response means Access is not in front: stop, remove the DNS record for `admin`, and fix the application before going on.**

Then in a private browser window: open `https://admin.azira.com.au/app`, enter a listed address, type the PIN from the email, and expect Medusa's login page. Repeat with an address that is not listed: no email arrives and no access is granted.

## Operating it

- **A new member of staff:** add the address to the `azira-staff` policy, create the Medusa user (Settings > Users in the admin).
- **Someone leaves:** remove the address from `azira-staff`, revoke their active Access sessions (search the Zero Trust dashboard for "Revoke"; if you cannot find it, their 24-hour session ends on its own), then delete or disable their Medusa user. Do all three the same day.
- **Locked out:** the account owner signs in to the Cloudflare dashboard (not through Access), adds their address to the policy, and tries again. Keep MFA on the Cloudflare account and on the mailbox that receives the PINs; the mailbox is part of the security perimeter.
- **PIN emails not arriving:** check spam; mail scanners can use the PIN link first ("This One-Time PIN has already been used"), so request a new code; allow `noreply@notify.cloudflare.com`.
- **Never** add a second public hostname for the same Medusa origin, a Bypass policy, a Service Auth token or a WARP route without redoing this review.

## Sources (copied from the earlier store's review of the Cloudflare docs; check the dashboard names again)

Self-hosted application steps, One-time PIN identity provider (not automatic for new organizations, 10 minute PIN), policy actions (Allow, Bypass) and the Emails selector, application and global session durations (default 24 hours).
