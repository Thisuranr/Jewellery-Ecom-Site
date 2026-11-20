#!/usr/bin/env bash
# apply-env.sh: reads the production settings from stdin, checks them against an
# allow-list, and writes the files the stack reads. Azira.
#
# Installed as /opt/azira/bin/apply-env.sh (root:root, 0755). It runs as root,
# through `sudo -n` from deploy-gate.sh (the `deploy` SSH user's forced command,
# request `env`) or by the admin with sudo. The GitHub workflow "Backend deploy"
# renders the payload from GitHub secrets and pipes it in, so nobody edits a
# server file by hand:
#
#   printf '%s\n' "KEY=value" ... | ssh deploy@host env
#
# Payload: lines of KEY=VALUE. Blank lines are ignored; anything else is refused.
# Nothing is written unless EVERY line and every required key passes, so a bad
# payload leaves the previous files as they were. Messages name keys only,
# never values.
#
# Files written (all of them are first written to temp files next to their
# destinations, and only when every temp file is complete are they renamed into
# place, so a failure half way leaves the previous set as it was):
#   /opt/azira/.env              0600 root  the backend's settings (medusa, migrate)
#   /opt/azira/redis.env         0600 root  REDIS_PASSWORD, read by the redis container only
#   /opt/azira/tunnel.env        0600 root  TUNNEL_TOKEN, read by cloudflared only
#   /opt/azira/certs/supabase-ca.crt 0644   the Supabase CA, from DB_CA_CERT_B64 (public)
#   /opt/azira/compose/.env      0644       BACKEND_IMAGE (not secret)
# And one side effect: docker login to ghcr.io from GHCR_USER + GHCR_TOKEN (the
# workflow's short-lived GITHUB_TOKEN), so the droplet can pull the private image.
#
# The image is pinned on the server: /opt/azira/image-pin.env (root:root 0644,
# written by infra/vps/bootstrap.sh) holds BACKEND_IMAGE_REPO and GHCR_OWNER.
# BACKEND_IMAGE must equal BACKEND_IMAGE_REPO and GHCR_USER must be GHCR_OWNER
# (compared in lower case), or the whole payload is refused. Without the pin file
# nothing is accepted. So the deploy key cannot make the droplet run (or log in
# to the registry as) anybody else's image. deploy.sh checks the pin again.
#
# Preview mode: CHECKOUT_PAUSED=true lets STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET
# and RESEND_API_KEY be absent and EMAIL_TRANSPORT be console. Anything else (or
# no CHECKOUT_PAUSED at all) means real sales: Stripe and Resend are required.
#
# Value rules (a value may be pasted by a person, then travels as one line):
# no $ " ' \ or backtick (Docker Compose would expand or unquote them), no
# control characters, no leading or trailing space, no " #" (a comment to
# Compose). Passwords therefore need to be URL-safe: docs/hosting.md says how.
#
# Exit codes: 0 applied; 1 refused or failed (nothing was changed, or only the
# docker login failed, which the message says).

set -euo pipefail
umask 077
export LC_ALL=C

# --- settings: infra/deploy/tests/run.sh rewrites only the lines in this block
SHOP_DIR=/opt/azira
REQUIRE_ROOT=1
DOCKER_CONFIG=/root/.docker
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# --- end of settings
export PATH DOCKER_CONFIG
readonly SHOP_DIR REQUIRE_ROOT

readonly MAX_BYTES=65536
readonly MAX_LINES=120

# Keys that go into /opt/azira/.env for the backend. A key listed in REQUIRED
# must be present and non-empty; the others may be absent or empty.
readonly REQUIRED_BACKEND=(
  DATABASE_URL DB_SSL DB_CA_PATH REDIS_URL
  JWT_SECRET COOKIE_SECRET STORE_CORS ADMIN_CORS AUTH_CORS
  FILE_PROVIDER FILE_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT R2_BUCKET
  EMAIL_TRANSPORT EMAIL_FROM
  STORE_NAME STORE_NOTIFY_EMAIL CUSTOM_ORDER_EMAIL STOREFRONT_URL MEDUSA_BACKEND_URL
)
readonly OPTIONAL_BACKEND=(
  EMAIL_REPLY_TO STORE_ABN WORKER_MODE MEDUSA_DISABLE_TELEMETRY CUSTOM_ENQUIRY_HOURLY_CAP
  R2_REGION
  CHECKOUT_PAUSED STRIPE_API_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY
)
# Keys this script consumes itself; never written to the backend's .env.
readonly REQUIRED_SPECIAL=(REDIS_PASSWORD TUNNEL_TOKEN DB_CA_CERT_B64 BACKEND_IMAGE)
readonly OPTIONAL_SPECIAL=(GHCR_USER GHCR_TOKEN)

declare -A VALUE=()
declare -A KIND=() # key -> backend | special
TMP_FILES=()
STAGED_TMP=()
STAGED_DEST=()

fail() {
  printf 'apply-env: refused: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  local f
  for f in "${TMP_FILES[@]+"${TMP_FILES[@]}"}"; do rm -f -- "$f"; done
}
trap cleanup EXIT

for k in "${REQUIRED_BACKEND[@]}" "${OPTIONAL_BACKEND[@]}"; do KIND[$k]=backend; done
for k in "${REQUIRED_SPECIAL[@]}" "${OPTIONAL_SPECIAL[@]}"; do KIND[$k]=special; done

# --- 1. read and parse ------------------------------------------------------
if [[ $REQUIRE_ROOT == 1 && $EUID -ne 0 ]]; then
  fail "run as root (sudo)"
fi

payload=$(head -c $((MAX_BYTES + 1)) || true)
((${#payload} <= MAX_BYTES)) || fail "the payload is larger than $MAX_BYTES bytes"
[[ -n $payload ]] || fail "the payload is empty"

readonly KEY_RE='^[A-Z][A-Z0-9_]{1,63}$'
# Forbidden in a value: $ " ' \ ` and every control character.
readonly BAD_VALUE_RE=$'[$"\'\\\\`[:cntrl:]]'

lines=0
while IFS= read -r line || [[ -n $line ]]; do
  lines=$((lines + 1))
  ((lines <= MAX_LINES)) || fail "more than $MAX_LINES lines"
  [[ -n $line ]] || continue
  [[ $line == *=* ]] || fail "line $lines is not KEY=VALUE"
  key=${line%%=*}
  val=${line#*=}
  [[ $key =~ $KEY_RE ]] || fail "line $lines: the key is not a valid name"
  [[ -n ${KIND[$key]+x} ]] || fail "line $lines: key $key is not on the allow-list"
  [[ -z ${VALUE[$key]+x} ]] || fail "key $key appears twice"
  if [[ $val =~ $BAD_VALUE_RE ]]; then
    fail "$key: the value holds a forbidden character (\$ \" ' \\ backtick or a control character)"
  fi
  [[ $val != " "* && $val != *" " ]] || fail "$key: the value has a space at its start or end"
  [[ $val != *" #"* ]] || fail "$key: the value holds ' #'"
  max=4096
  [[ $key == DB_CA_CERT_B64 ]] && max=32768
  ((${#val} <= max)) || fail "$key: the value is longer than $max characters"
  VALUE[$key]=$val
done <<<"$payload"

for k in "${REQUIRED_BACKEND[@]}" "${REQUIRED_SPECIAL[@]}"; do
  [[ -n ${VALUE[$k]-} ]] || fail "required key $k is missing or empty"
done

# Preview mode or real sales. CHECKOUT_PAUSED is exactly true or false.
paused=0
if [[ -n ${VALUE[CHECKOUT_PAUSED]-} ]]; then
  [[ ${VALUE[CHECKOUT_PAUSED]} == true || ${VALUE[CHECKOUT_PAUSED]} == false ]] ||
    fail "CHECKOUT_PAUSED must be true or false"
  [[ ${VALUE[CHECKOUT_PAUSED]} == true ]] && paused=1
fi
if ((paused == 0)); then
  for k in STRIPE_API_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY; do
    [[ -n ${VALUE[$k]-} ]] || fail "required key $k is missing or empty (set CHECKOUT_PAUSED=true only for a preview without payments)"
  done
  [[ ${VALUE[EMAIL_TRANSPORT]} == resend ]] || fail "EMAIL_TRANSPORT must be resend unless CHECKOUT_PAUSED=true"
else
  [[ ${VALUE[EMAIL_TRANSPORT]} == resend || ${VALUE[EMAIL_TRANSPORT]} == console ]] ||
    fail "EMAIL_TRANSPORT must be resend or console"
  if [[ ${VALUE[EMAIL_TRANSPORT]} == resend ]]; then
    [[ -n ${VALUE[RESEND_API_KEY]-} ]] || fail "RESEND_API_KEY is required when EMAIL_TRANSPORT is resend"
  fi
  # A half-set Stripe pair is a mistake, not a preview.
  if [[ -n ${VALUE[STRIPE_API_KEY]-} || -n ${VALUE[STRIPE_WEBHOOK_SECRET]-} ]]; then
    [[ -n ${VALUE[STRIPE_API_KEY]-} && -n ${VALUE[STRIPE_WEBHOOK_SECRET]-} ]] ||
      fail "STRIPE_API_KEY and STRIPE_WEBHOOK_SECRET must be given together"
  fi
fi

# --- 2. format checks for the keys that wire the stack together -------------
[[ ${VALUE[DB_SSL]} == true ]] || fail "DB_SSL must be true"
[[ ${VALUE[DB_CA_PATH]} == /run/secrets/supabase-ca.crt ]] || fail "DB_CA_PATH must be /run/secrets/supabase-ca.crt"
[[ ${VALUE[DATABASE_URL]} =~ ^postgres(ql)?:// ]] || fail "DATABASE_URL must be a postgres:// URL"
[[ ${VALUE[FILE_PROVIDER]} == s3 ]] || fail "FILE_PROVIDER must be s3"
[[ ${VALUE[REDIS_PASSWORD]} =~ ^[A-Za-z0-9]{24,128}$ ]] || fail "REDIS_PASSWORD must be 24 to 128 letters and digits"
[[ ${VALUE[REDIS_URL]} == "redis://:${VALUE[REDIS_PASSWORD]}@redis:6379" ]] ||
  fail "REDIS_URL must be exactly redis://:<REDIS_PASSWORD>@redis:6379 (the redis container on the compose network)"
[[ ${VALUE[TUNNEL_TOKEN]} =~ ^[A-Za-z0-9_=+/-]{40,4000}$ ]] || fail "TUNNEL_TOKEN does not look like a Cloudflare tunnel token"
[[ ${VALUE[BACKEND_IMAGE]} =~ ^ghcr\.io/[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._/-]*$ ]] ||
  fail "BACKEND_IMAGE must be a lowercase ghcr.io/<owner>/<name> reference without a tag"

# The pinned image and registry user (written at bootstrap, root-owned).
pin_get() { # pin_get <key>: the value from the pin file, or nothing
  local line
  line=$(grep -m1 -E "^$1=" "$PIN_FILE" 2>/dev/null || true)
  printf '%s' "${line#*=}"
}
readonly PIN_FILE="$SHOP_DIR/image-pin.env"
[[ -f $PIN_FILE ]] || fail "$PIN_FILE is missing; run infra/vps/bootstrap.sh (it pins the image repository)"
PIN_REPO=$(pin_get BACKEND_IMAGE_REPO)
PIN_OWNER=$(pin_get GHCR_OWNER)
[[ $PIN_REPO =~ ^ghcr\.io/[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._/-]*$ && $PIN_OWNER =~ ^[a-z0-9][a-z0-9-]{0,38}$ ]] ||
  fail "$PIN_FILE does not hold a valid BACKEND_IMAGE_REPO and GHCR_OWNER"
[[ ${VALUE[BACKEND_IMAGE]} == "$PIN_REPO" ]] || fail "BACKEND_IMAGE is not the image this server is pinned to"
if [[ -n ${VALUE[GHCR_TOKEN]-} ]]; then
  [[ ${VALUE[GHCR_USER]-} =~ ^[A-Za-z0-9-]{1,39}$ ]] || fail "GHCR_USER must be a GitHub user name when GHCR_TOKEN is given"
  user_lc=${VALUE[GHCR_USER],,}
  [[ $user_lc == "$PIN_OWNER" ]] || fail "GHCR_USER is not the registry user this server is pinned to"
  # GitHub's installation tokens (the Actions GITHUB_TOKEN included) are ghs_-prefixed
  # JWTs since 2026: about 520 characters, variable length, with dots and dashes.
  [[ ${VALUE[GHCR_TOKEN]} =~ ^[A-Za-z0-9_.-]{20,4096}$ ]] || fail "GHCR_TOKEN does not look like a GitHub token"
fi

# The CA: base64 of a PEM file with at least one certificate that openssl reads.
ca_tmp=$(mktemp)
TMP_FILES+=("$ca_tmp")
printf '%s' "${VALUE[DB_CA_CERT_B64]}" | base64 -d >"$ca_tmp" 2>/dev/null || fail "DB_CA_CERT_B64 is not valid base64"
grep -q -- '-----BEGIN CERTIFICATE-----' "$ca_tmp" || fail "DB_CA_CERT_B64 does not hold a PEM certificate"
if command -v openssl >/dev/null 2>&1; then
  openssl x509 -noout -in "$ca_tmp" 2>/dev/null || fail "DB_CA_CERT_B64: openssl cannot read the certificate"
fi

# --- 3. one deploy at a time, then write ------------------------------------
mkdir -p "$SHOP_DIR/certs" "$SHOP_DIR/compose"
exec 9>"$SHOP_DIR/deploy.lock"
flock -w 300 9 || fail "a deploy is running and did not finish within 300 s; try again"

# write_file <dest> <mode>: the content comes on stdin. Only stages a temp file
# next to <dest>; commit_files renames them all once every file is complete.
write_file() {
  local dest=$1 mode=$2 tmp
  tmp=$(mktemp "$dest.XXXXXX")
  TMP_FILES+=("$tmp")
  cat >"$tmp"
  chmod "$mode" "$tmp"
  STAGED_TMP+=("$tmp")
  STAGED_DEST+=("$dest")
}

commit_files() {
  local i
  for i in "${!STAGED_TMP[@]}"; do
    mv -f -- "${STAGED_TMP[$i]}" "${STAGED_DEST[$i]}"
  done
}

backend_env() {
  local k
  for k in "${REQUIRED_BACKEND[@]}" "${OPTIONAL_BACKEND[@]}"; do
    [[ -n ${VALUE[$k]-} ]] && printf '%s=%s\n' "$k" "${VALUE[$k]}"
  done
  return 0
}

# Not through a pipe: write_file must run in this shell to keep its staging lists.
write_file "$SHOP_DIR/.env" 0600 < <(backend_env)
write_file "$SHOP_DIR/redis.env" 0600 <<<"REDIS_PASSWORD=${VALUE[REDIS_PASSWORD]}"
write_file "$SHOP_DIR/tunnel.env" 0600 <<<"TUNNEL_TOKEN=${VALUE[TUNNEL_TOKEN]}"
write_file "$SHOP_DIR/certs/supabase-ca.crt" 0644 <"$ca_tmp"
write_file "$SHOP_DIR/compose/.env" 0644 <<<"BACKEND_IMAGE=${VALUE[BACKEND_IMAGE]}"
commit_files

count=0
for k in "${!VALUE[@]}"; do count=$((count + 1)); done
printf 'apply-env: wrote %s settings (names checked, values not shown)\n' "$count"

# --- 4. let the droplet pull the private image -------------------------------
if [[ -n ${VALUE[GHCR_TOKEN]-} ]]; then
  if printf '%s' "${VALUE[GHCR_TOKEN]}" | docker login ghcr.io -u "${VALUE[GHCR_USER]}" --password-stdin >/dev/null 2>&1; then
    echo "apply-env: docker login to ghcr.io worked"
  else
    echo "apply-env: settings were written, but docker login to ghcr.io FAILED" >&2
    exit 1
  fi
fi
