#!/usr/bin/env bash
# Tests for deploy.sh and deploy-gate.sh. Plain bash, no bats, no Docker:
#   bash infra/deploy/tests/run.sh
# Runs on Linux and in Git Bash on Windows.
#
# Each case runs a copy of the script whose settings block (and only that
# block) points at a temporary /opt/azira and at the stubs in ./stubs, which log
# every docker and sudo call. The real scripts are checked to still hold the
# production settings, so a test copy can never be mistaken for them.
# The checks below pass values to `bash -c '...'` as $0, $1...; the single
# quotes are deliberate, so SC2016 is off for this file.
# shellcheck disable=SC2016
set -euo pipefail
export LC_ALL=C

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEPLOY_SH="$HERE/../deploy.sh"
GATE_SH="$HERE/../deploy-gate.sh"
APPLY_SH="$HERE/../apply-env.sh"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

SHA_A=1111111111111111111111111111111111111111
SHA_B=2222222222222222222222222222222222222222
SHA_C=3333333333333333333333333333333333333333
SHA_NEW=abcdef0123456789abcdef0123456789abcdef01

pass=0
fail=0
ok() { pass=$((pass + 1)); printf 'ok    %s\n' "$1"; }
not_ok() { fail=$((fail + 1)); printf 'FAIL  %s\n' "$1"; [[ -z ${2-} ]] || printf '      %s\n' "$2"; }
check() { # check <name> <command...>
  local name=$1
  shift
  if "$@"; then ok "$name"; else not_ok "$name"; fi
}

# --- the production settings are intact ----------------------------------
check "deploy.sh settings are the production ones" \
  grep -qx 'SHOP_DIR=/opt/azira' "$DEPLOY_SH"
check "deploy.sh requires root" grep -qx 'REQUIRE_ROOT=1' "$DEPLOY_SH"
check "deploy.sh health timeout is 120 s" grep -qx 'HEALTH_TIMEOUT=120' "$DEPLOY_SH"
check "deploy.sh sets a fixed PATH" \
  grep -qx 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' "$DEPLOY_SH"
check "deploy-gate.sh calls /usr/bin/sudo, deploy.sh and apply-env.sh" \
  bash -c "grep -qx 'SUDO=/usr/bin/sudo' '$GATE_SH' && grep -qx 'DEPLOY_SH=/opt/azira/bin/deploy.sh' '$GATE_SH' && grep -qx 'APPLY_ENV_SH=/opt/azira/bin/apply-env.sh' '$GATE_SH'"
check "apply-env.sh settings are the production ones" \
  bash -c "grep -qx 'SHOP_DIR=/opt/azira' '$APPLY_SH' && grep -qx 'REQUIRE_ROOT=1' '$APPLY_SH'"

# --- fixtures -------------------------------------------------------------
STUBS="$WORK/stubs"
mkdir -p "$STUBS"
cp "$HERE/stubs/docker" "$HERE/stubs/date" "$HERE/stubs/sudo" "$STUBS/"
if command -v flock >/dev/null 2>&1; then
  REAL_FLOCK=1
else
  REAL_FLOCK=0
  cp "$HERE/stubs/flock-fallback" "$STUBS/flock"
fi
chmod +x "$STUBS"/*

# new_case: a fresh /opt/azira, stub state and patched deploy.sh in $CASE.
new_case() {
  CASE=$(mktemp -d "$WORK/case.XXXXXX")
  SHOP="$CASE/shop"
  mkdir -p "$SHOP/compose" "$CASE/state"
  export STUB_LOG="$CASE/docker.log" STUB_STATE="$CASE/state" STUB_SUDO_ARGS="$CASE/sudo.args"
  : >"$STUB_LOG"
  unset STUB_FAIL_PULL STUB_FAIL_MIGRATE STUB_FAIL_UP STUB_FAIL_SERVICES STUB_UNHEALTHY \
    STUB_STARTING STUB_BAD_LABEL STUB_IMAGES STUB_LOCK_HELD FAKE_HOUR FAKE_OFFSET
  sed -e "s#^SHOP_DIR=.*#SHOP_DIR=$SHOP#" \
    -e "s#^COMPOSE_DIR=.*#COMPOSE_DIR=$SHOP/compose#" \
    -e "s#^HEALTH_TIMEOUT=.*#HEALTH_TIMEOUT=3#" \
    -e "s#^HEALTH_INTERVAL=.*#HEALTH_INTERVAL=1#" \
    -e "s#^REQUIRE_ROOT=.*#REQUIRE_ROOT=0#" \
    -e "s#^DOCKER_CONFIG=.*#DOCKER_CONFIG=$CASE/docker-config#" \
    -e "s#^PATH=.*#PATH=$STUBS:/usr/bin:/bin#" \
    "$DEPLOY_SH" >"$CASE/deploy.sh"
  if ! grep -qx "SHOP_DIR=$SHOP" "$CASE/deploy.sh" || ! grep -qx "PATH=$STUBS:/usr/bin:/bin" "$CASE/deploy.sh"; then
    echo "could not patch the settings block of deploy.sh" >&2
    exit 1
  fi
}

# run_deploy <args...>: sets OUT and RC.
run_deploy() {
  set +e
  OUT=$(bash "$CASE/deploy.sh" "$@" 2>&1)
  RC=$?
  set -e
}

calls() { grep -c -- "$1" "$STUB_LOG" || true; }
called() { [[ $(calls "$1") -gt 0 ]]; }
not_called() { [[ $(calls "$1") -eq 0 ]]; }
no_docker() { [[ ! -s $STUB_LOG ]]; }
current_tag() { cat "$SHOP/current_tag" 2>/dev/null || true; }

expect() { # expect <case name> <condition...>; prints the output on failure
  local name=$1
  shift
  if "$@"; then ok "$name"; else not_ok "$name" "rc=$RC output: $(printf '%s' "$OUT" | tr '\n' '|')"; fi
}

# --- deploy.sh: arguments ---------------------------------------------------
for bad in "" "ABCDEF0123456789ABCDEF0123456789ABCDEF01" "abc123" "${SHA_NEW}0" \
  "${SHA_NEW:0:39};" "$SHA_NEW;id" '$(id)' "-h" "../../etc/passwd"; do
  new_case
  if [[ -z $bad ]]; then run_deploy; else run_deploy "$bad"; fi
  expect "deploy.sh refuses argument [${bad:-<none>}]" \
    bash -c '[[ $0 == 1 ]] && [[ $1 == *refused* ]] && [[ ! -s $2 ]]' "$RC" "$OUT" "$STUB_LOG"
done

new_case
run_deploy "$SHA_NEW" --force
expect "deploy.sh refuses an unknown option" \
  bash -c '[[ $0 == 1 && $1 == *"unknown option"* && ! -s $2 ]]' "$RC" "$OUT" "$STUB_LOG"

new_case
run_deploy "$SHA_NEW" --now extra
expect "deploy.sh refuses a third argument" \
  bash -c '[[ $0 == 1 && $1 == *usage* && ! -s $2 ]]' "$RC" "$OUT" "$STUB_LOG"

new_case
run_deploy "ABCDEF0123456789ABCDEF0123456789ABCDEF01"
expect "deploy.sh never echoes a refused argument" \
  bash -c '[[ $0 != *ABCDEF0123* ]]' "$OUT"

# --- deploy.sh: lock --------------------------------------------------------
new_case
if [[ $REAL_FLOCK == 1 ]]; then
  flock "$SHOP/deploy.lock" sleep 5 &
  holder=$!
  sleep 1
  run_deploy "$SHA_NEW"
  kill "$holder" 2>/dev/null || true
  wait "$holder" 2>/dev/null || true
  lock_note="real flock"
else
  export STUB_LOCK_HELD=1
  run_deploy "$SHA_NEW"
  lock_note="flock stand-in: util-linux flock missing"
fi
expect "deploy.sh refuses while another deploy holds the lock ($lock_note)" \
  bash -c '[[ $0 == 1 && $1 == *"another deploy is running"* && ! -s $2 ]]' "$RC" "$OUT" "$STUB_LOG"

# --- deploy.sh: window (optional: DEPLOY_WINDOW in the settings block) -------
# use_window <HH-HH>: turns the window on in this case's copy of deploy.sh.
use_window() {
  sed -i "s#^DEPLOY_WINDOW=.*#DEPLOY_WINDOW=$1#" "$CASE/deploy.sh"
  grep -qx "DEPLOY_WINDOW=$1" "$CASE/deploy.sh"
}

check "deploy.sh has no deploy window in production (any time)" grep -qx 'DEPLOY_WINDOW=' "$DEPLOY_SH"

new_case
export FAKE_HOUR=14
run_deploy "$SHA_NEW"
expect "deploy.sh deploys at any hour when no window is set" \
  bash -c '[[ $0 == 0 ]] && [[ $(cat "$1") == "$2" ]]' "$RC" "$SHOP/current_tag" "$SHA_NEW"

new_case
use_window 02-05
export FAKE_HOUR=14
run_deploy "$SHA_NEW"
expect "deploy.sh refuses outside a set 02-05 Sydney window without --now" \
  bash -c '[[ $0 == 1 && $1 == *"deploy window"* && ! -s $2 ]]' "$RC" "$OUT" "$STUB_LOG"
expect "the window refusal is logged in deploy.log" grep -q "outside the 02-05" "$SHOP/deploy.log"

for h in 01 05 23; do
  new_case
  use_window 02-05
  export FAKE_HOUR=$h
  run_deploy "$SHA_NEW"
  expect "deploy.sh refuses at Sydney hour $h" bash -c '[[ $0 == 1 && ! -s $1 ]]' "$RC" "$STUB_LOG"
done

for h in 02 04 08 09; do
  new_case
  use_window 02-05
  export FAKE_HOUR=$h
  run_deploy "$SHA_NEW" --now
  expect "deploy.sh deploys at Sydney hour $h with --now" \
    bash -c '[[ $0 == 0 ]] && [[ $(cat "$1") == "$2" ]]' "$RC" "$SHOP/current_tag" "$SHA_NEW"
done
expect "--now outside the window is logged" grep -q -- "--now given" "$SHOP/deploy.log"

new_case
use_window 02-05
export FAKE_OFFSET=+0000
run_deploy "$SHA_NEW"
expect "deploy.sh refuses when Australia/Sydney time can't be read" \
  bash -c '[[ $0 == 1 && $1 == *tzdata* && ! -s $2 ]]' "$RC" "$OUT" "$STUB_LOG"

new_case
use_window "2-5"
run_deploy "$SHA_NEW"
expect "deploy.sh refuses a malformed DEPLOY_WINDOW" \
  bash -c '[[ $0 == 1 && $1 == *"DEPLOY_WINDOW must"* && ! -s $2 ]]' "$RC" "$OUT" "$STUB_LOG"

# --- deploy.sh: success -----------------------------------------------------
new_case
echo "$SHA_B" >"$SHOP/current_tag"
printf '%s\n' "2026-01-01T02:00:00Z deployed sha=$SHA_A prev=none" \
  "2026-01-02T02:00:00Z deployed sha=$SHA_C prev=$SHA_A" \
  "2026-01-03T02:00:00Z deployed sha=$SHA_B prev=$SHA_C" >"$SHOP/deploy.log"
export STUB_IMAGES="$SHA_A $SHA_B $SHA_C $SHA_NEW 4444444444444444444444444444444444444444"
run_deploy "$SHA_NEW"
expect "success: exit 0" bash -c '[[ $0 == 0 ]]' "$RC"
expect "success: current_tag is the new sha" bash -c '[[ $(cat "$0") == "$1" ]]' "$SHOP/current_tag" "$SHA_NEW"
expect "success: deploy.log records deployed with prev" grep -q "deployed sha=$SHA_NEW prev=$SHA_B" "$SHOP/deploy.log"
expect "success: steps ran in order pull, services, migrate, up" bash -c '
  grep -n -e "pull medusa" -e "redis cloudflared" -e "run --rm -T migrate" -e "up -d --no-deps medusa" "$0" |
    cut -d: -f1 | tr "\n" " " | awk "{ exit !(\$1 < \$2 && \$2 < \$3 && \$3 < \$4) }"' "$STUB_LOG"
expect "success: every compose call carries IMAGE_TAG=<sha>" \
  bash -c '! grep "docker compose" "$0" | grep -qv "^IMAGE_TAG=$1 "' "$STUB_LOG" "$SHA_NEW"
expect "success: redis and cloudflared are started without recreating or deps" \
  grep -q -- "up -d --wait --wait-timeout 60 --no-deps --no-recreate redis cloudflared" "$STUB_LOG"
expect "success: prune keeps the last 3 deployed tags" \
  bash -c 'grep -q "image rm .*:$1" "$0" && grep -q "image rm .*:4444444444444444444444444444444444444444" "$0" &&
    ! grep -q -e "image rm .*:$2" -e "image rm .*:$3" -e "image rm .*:$4" -e "image rm .*<none>" "$0"' \
    "$STUB_LOG" "$SHA_A" "$SHA_B" "$SHA_C" "$SHA_NEW"
expect "success: the per-deploy log exists" bash -c 'ls "$0"/logs/deploy-*-abcdef012345.log >/dev/null' "$SHOP"
expect "success: no 'aborted' line" bash -c '! grep -q aborted "$0"' "$SHOP/deploy.log"

# An owner running deploy.sh by hand in a terminal: the migrate container must
# not read that terminal. db:migrate's link-sync prompt (a removed or changed
# module link, e.g. rolling back across a Medusa upgrade) would wait there
# invisibly, its output going to the per-deploy log, and a keypress could
# choose to DROP link tables. With stdin closed the prompt fails and the
# deploy stops before the swap.
new_case
export STUB_PROBE_STDIN=1
set +e
OUT=$(printf 'a

' | bash "$CASE/deploy.sh" "$SHA_NEW" 2>&1)
RC=$?
set -e
unset STUB_PROBE_STDIN
expect "migrate never reads the caller's stdin" bash -c '[[ $0 == 0 ]] && grep -q "run --rm -T migrate" "$1" && ! grep -q "migrate read stdin" "$1"' "$RC" "$STUB_LOG"

# --- deploy.sh: failures before the swap -----------------------------------
new_case
echo "$SHA_B" >"$SHOP/current_tag"
export STUB_FAIL_PULL=1
run_deploy "$SHA_NEW"
expect "pull fails: exit 1, nothing else runs" \
  bash -c '[[ $0 == 1 ]] && ! grep -q -e migrate -e "up " "$1" && [[ $(cat "$2") == "$3" ]]' \
  "$RC" "$STUB_LOG" "$SHOP/current_tag" "$SHA_B"

new_case
echo "$SHA_B" >"$SHOP/current_tag"
export STUB_BAD_LABEL=1
run_deploy "$SHA_NEW"
expect "revision label mismatch: exit 1, no migrate" \
  bash -c '[[ $0 == 1 && $1 == *"revision label"* ]] && ! grep -q migrate "$2"' "$RC" "$OUT" "$STUB_LOG"

new_case
export STUB_FAIL_SERVICES=1
run_deploy "$SHA_NEW"
expect "redis/cloudflared fail to start: exit 1, no migrate" \
  bash -c '[[ $0 == 1 ]] && ! grep -q migrate "$1"' "$RC" "$STUB_LOG"

new_case
echo "$SHA_B" >"$SHOP/current_tag"
export STUB_FAIL_MIGRATE=1
run_deploy "$SHA_NEW"
expect "migrate fails: exit 1, no up, current_tag unchanged" \
  bash -c '[[ $0 == 1 && $1 == *"migrations failed"* ]] && ! grep -q "up -d --no-deps medusa" "$2" && [[ $(cat "$3") == "$4" ]]' \
  "$RC" "$OUT" "$STUB_LOG" "$SHOP/current_tag" "$SHA_B"

new_case
echo "not-a-sha" >"$SHOP/current_tag"
run_deploy "$SHA_NEW"
expect "a corrupt current_tag is refused before any docker call" \
  bash -c '[[ $0 == 1 && ! -s $1 ]]' "$RC" "$STUB_LOG"

# --- deploy.sh: health check and rollback ----------------------------------
new_case
echo "$SHA_B" >"$SHOP/current_tag"
export STUB_UNHEALTHY="$SHA_NEW"
run_deploy "$SHA_NEW"
expect "unhealthy: exit 1" bash -c '[[ $0 == 1 ]]' "$RC"
expect "unhealthy: PREV is brought back up" grep -q "^IMAGE_TAG=$SHA_B docker compose .* up -d --no-deps medusa" "$STUB_LOG"
expect "unhealthy: PREV runs again" bash -c '[[ $(cat "$0") == "$1" ]]' "$CASE/state/running" "$SHA_B"
expect "unhealthy: current_tag stays PREV" bash -c '[[ $(cat "$0") == "$1" ]]' "$SHOP/current_tag" "$SHA_B"
expect "unhealthy: the log says migrations stay applied" \
  grep -q "rolled back sha=$SHA_NEW prev=$SHA_B: .*migrations from $SHA_NEW stay applied" "$SHOP/deploy.log"
expect "unhealthy: no image is pruned" bash -c '! grep -q "image rm" "$0"' "$STUB_LOG"

new_case
echo "$SHA_B" >"$SHOP/current_tag"
export STUB_STARTING="$SHA_NEW"
run_deploy "$SHA_NEW"
expect "never healthy (timeout): rolled back to PREV, exit 1" \
  bash -c '[[ $0 == 1 && $(cat "$1") == "$2" ]] && grep -q "rolled back" "$3"' \
  "$RC" "$CASE/state/running" "$SHA_B" "$SHOP/deploy.log"

new_case
echo "$SHA_B" >"$SHOP/current_tag"
export STUB_FAIL_UP=1
run_deploy "$SHA_NEW"
expect "up fails: rollback attempted, exit 2 when PREV can't start either" \
  bash -c '[[ $0 == 2 ]] && grep -q "ROLLBACK FAILED" "$1"' "$RC" "$SHOP/deploy.log"

new_case
echo "$SHA_B" >"$SHOP/current_tag"
export STUB_UNHEALTHY="$SHA_NEW $SHA_B"
run_deploy "$SHA_NEW"
expect "PREV unhealthy too: exit 2, ROLLBACK FAILED logged" \
  bash -c '[[ $0 == 2 ]] && grep -q "ROLLBACK FAILED sha=$2 prev=$3" "$1"' "$RC" "$SHOP/deploy.log" "$SHA_NEW" "$SHA_B"

new_case
export STUB_UNHEALTHY="$SHA_NEW"
run_deploy "$SHA_NEW"
expect "first deploy unhealthy: medusa stopped, exit 1, no current_tag" \
  bash -c '[[ $0 == 1 ]] && grep -q "stop medusa" "$1" && [[ ! -e $2 && ! -e $3 ]] && grep -q "first deploy, no previous tag" "$4"' \
  "$RC" "$STUB_LOG" "$SHOP/current_tag" "$CASE/state/running" "$SHOP/deploy.log"

new_case
run_deploy "$SHA_NEW"
expect "first deploy healthy: exit 0, current_tag written, prev=none" \
  bash -c '[[ $0 == 0 && $(cat "$1") == "$2" ]] && grep -q "deployed sha=$2 prev=none" "$3"' \
  "$RC" "$SHOP/current_tag" "$SHA_NEW" "$SHOP/deploy.log"

# --- deploy-gate.sh ---------------------------------------------------------
GATE_CASE="$WORK/gate"
mkdir -p "$GATE_CASE"
sed -e "s#^SUDO=.*#SUDO=$STUBS/sudo#" -e "s#^PATH=.*#PATH=$STUBS:/usr/bin:/bin#" "$GATE_SH" >"$GATE_CASE/gate.sh"
grep -qx "SUDO=$STUBS/sudo" "$GATE_CASE/gate.sh" || { echo "could not patch deploy-gate.sh" >&2; exit 1; }
export STUB_SUDO_ARGS="$GATE_CASE/sudo.args"

gate() { # gate <SSH_ORIGINAL_COMMAND | __unset__>: sets RC and OUT
  rm -f "$STUB_SUDO_ARGS"
  set +e
  if [[ $1 == __unset__ ]]; then
    OUT=$(env -u SSH_ORIGINAL_COMMAND bash "$GATE_CASE/gate.sh" 2>&1)
  else
    OUT=$(SSH_ORIGINAL_COMMAND=$1 bash "$GATE_CASE/gate.sh" 2>&1)
  fi
  RC=$?
  set -e
}
sudo_args() { tr '\n' ' ' <"$STUB_SUDO_ARGS" 2>/dev/null || true; }

gate "deploy $SHA_NEW"
expect "gate: 'deploy <sha>' runs sudo -n deploy.sh <sha>" \
  bash -c '[[ $0 == 0 && $1 == "-n /opt/azira/bin/deploy.sh $2 " ]]' "$RC" "$(sudo_args)" "$SHA_NEW"

gate "deploy $SHA_NEW --now"
expect "gate: 'deploy <sha> --now' passes --now as its own word" \
  bash -c '[[ $0 == 0 && $1 == "-n /opt/azira/bin/deploy.sh $2 --now " ]]' "$RC" "$(sudo_args)" "$SHA_NEW"

gate "env"
expect "gate: 'env' runs sudo -n apply-env.sh and nothing else" \
  bash -c '[[ $0 == 0 && $1 == "-n /opt/azira/bin/apply-env.sh " ]]' "$RC" "$(sudo_args)"

nl=$'\n'
for bad in "env " " env" "env x" "ENV" "env;id" "env --now" "envs" "env$nl" "env $SHA_NEW" "apply-env" "sudo -n /opt/azira/bin/apply-env.sh" \ 'deploy $(id)' "deploy $SHA_NEW; rm -rf /" "deploy $SHA_NEW && id" "deploy $SHA_NEW | sh" \
  "deploy $SHA_NEW${nl}rm -rf /" "deploy $SHA_NEW$nl" "deploy \`id\`" "" " deploy $SHA_NEW" "deploy $SHA_NEW " \
  "deploy  $SHA_NEW" "deploy ${SHA_NEW^^}" "deploy ${SHA_NEW:0:39}" "deploy ${SHA_NEW}0" "deploy $SHA_NEW --now --now" \
  "deploy $SHA_NEW --force" "deploy $SHA_NEW -now" "deploy" "rollback $SHA_NEW" "bash" "sudo -n /opt/azira/bin/deploy.sh $SHA_NEW" \
  "deploy $SHA_NEW"$'\t'"--now" "DEPLOY $SHA_NEW"; do
  gate "$bad"
  shown=$(printf '%s' "$bad" | tr '\n\t' '~>')
  expect "gate: refuses [${shown:-<empty>}]" \
    bash -c '[[ $0 == 1 && ! -e $1 && $2 == *refused* ]]' "$RC" "$STUB_SUDO_ARGS" "$OUT"
done

gate __unset__
expect "gate: refuses when SSH_ORIGINAL_COMMAND is unset (interactive login)" \
  bash -c '[[ $0 == 1 && ! -e $1 ]]' "$RC" "$STUB_SUDO_ARGS"

gate 'deploy $(touch /tmp/gate-pwned)'
expect "gate: never echoes the refused request" bash -c '[[ $0 != *touch* ]]' "$OUT"

# --- apply-env.sh ------------------------------------------------------------
# A real throwaway self-signed certificate: apply-env.sh checks it with openssl.
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 2 \
  -subj "/CN=test-ca" -keyout "$WORK/ca.key" -out "$WORK/ca.crt" >/dev/null 2>&1
CA_B64=$(base64 <"$WORK/ca.crt" | tr -d '\n')
RPW=abcdefghijklmnopqrstuvwx0123456789

good_payload() {
  cat <<PAYLOAD
DATABASE_URL=postgresql://postgres.abc:pw%40word@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres
DB_SSL=true
DB_CA_PATH=/run/secrets/supabase-ca.crt
DB_CA_CERT_B64=$CA_B64
REDIS_URL=redis://:$RPW@redis:6379
REDIS_PASSWORD=$RPW
JWT_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef
COOKIE_SECRET=fedcba9876543210fedcba9876543210fedcba9876543210
STORE_CORS=https://azira.com.au,https://www.azira.com.au
ADMIN_CORS=https://admin.azira.com.au
AUTH_CORS=https://admin.azira.com.au,https://azira.com.au
STRIPE_API_KEY=sk_live_abcdefghijklmnopqrstuv
STRIPE_WEBHOOK_SECRET=whsec_abcdefghijklmnopqrstuv
FILE_PROVIDER=s3
FILE_URL=https://img.azira.com.au
R2_ACCESS_KEY_ID=abc123
R2_SECRET_ACCESS_KEY=def456
R2_ENDPOINT=https://7b7865326875e0dea1285c31309d77a4.r2.cloudflarestorage.com
R2_BUCKET=azira-images
EMAIL_TRANSPORT=resend
RESEND_API_KEY=re_abcdefghijk
EMAIL_FROM=Azira <orders@azira.com.au>
STORE_NAME=Azira
STORE_NOTIFY_EMAIL=owner@azira.com.au
CUSTOM_ORDER_EMAIL=orders@azira.com.au
STOREFRONT_URL=https://azira.com.au/au
MEDUSA_BACKEND_URL=https://admin.azira.com.au
TUNNEL_TOKEN=eyJhIjoiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCJ0IjoiMTIzNCJ9
BACKEND_IMAGE=ghcr.io/azira-owner/azira-backend
GHCR_USER=azira-owner
GHCR_TOKEN=ghs_abcdefghijklmnopqrstuvwxyz0123456789
PAYLOAD
}

new_env_case() {
  CASE=$(mktemp -d "$WORK/env.XXXXXX")
  ESHOP="$CASE/azira"
  mkdir -p "$ESHOP"
  export STUB_LOG="$CASE/docker.log" STUB_STATE="$CASE/state"
  : >"$STUB_LOG"
  unset STUB_FAIL_LOGIN
  sed -e "s#^SHOP_DIR=.*#SHOP_DIR=$ESHOP#" -e "s#^REQUIRE_ROOT=.*#REQUIRE_ROOT=0#" \
    -e "s#^DOCKER_CONFIG=.*#DOCKER_CONFIG=$CASE/docker-config#" -e "s#^PATH=.*#PATH=$STUBS:/usr/bin:/bin#" \
    "$APPLY_SH" >"$CASE/apply-env.sh"
  grep -qx "SHOP_DIR=$ESHOP" "$CASE/apply-env.sh" || { echo "could not patch apply-env.sh" >&2; exit 1; }
}
# run_env <payload>: sets OUT and RC
run_env() {
  set +e
  OUT=$(printf '%s\n' "$1" | bash "$CASE/apply-env.sh" 2>&1)
  RC=$?
  set -e
}
nothing_written() { [[ -z $(ls -A "$ESHOP" 2>/dev/null | grep -v '^deploy.lock$' || true) ]]; }
mode_of() { stat -c '%a' "$1"; }

new_env_case
run_env "$(good_payload)"
expect "apply-env: a good payload is applied" bash -c '[[ $0 == 0 ]]' "$RC"
expect "apply-env: .env is 0600 and holds the backend keys" \
  bash -c '[[ $(stat -c %a "$0/.env") == 600 ]] && grep -qx "STRIPE_API_KEY=sk_live_abcdefghijklmnopqrstuv" "$0/.env" && grep -qx "EMAIL_FROM=Azira <orders@azira.com.au>" "$0/.env"' "$ESHOP"
expect "apply-env: .env holds no redis password line, tunnel token or ghcr token" \
  bash -c '! grep -qE "^(REDIS_PASSWORD|TUNNEL_TOKEN|GHCR_TOKEN|GHCR_USER|DB_CA_CERT_B64|BACKEND_IMAGE)=" "$0/.env"' "$ESHOP"
expect "apply-env: redis.env and tunnel.env are 0600 with one key each" \
  bash -c '[[ $(stat -c %a "$0/redis.env") == 600 && $(stat -c %a "$0/tunnel.env") == 600 ]] && [[ $(wc -l <"$0/redis.env") == 1 && $(wc -l <"$0/tunnel.env") == 1 ]] && grep -q "^REDIS_PASSWORD=" "$0/redis.env" && grep -q "^TUNNEL_TOKEN=" "$0/tunnel.env"' "$ESHOP"
expect "apply-env: the CA is written 0644 and matches" \
  bash -c '[[ $(stat -c %a "$0/certs/supabase-ca.crt") == 644 ]] && grep -q "BEGIN CERTIFICATE" "$0/certs/supabase-ca.crt"' "$ESHOP"
expect "apply-env: compose/.env holds BACKEND_IMAGE" \
  bash -c 'grep -qx "BACKEND_IMAGE=ghcr.io/azira-owner/azira-backend" "$0/compose/.env"' "$ESHOP"
expect "apply-env: docker login ran with the token on stdin, not in argv" \
  bash -c 'grep -q "^login-token-length=40$" "$0" && ! grep -q "ghs_" "$0"' "$STUB_LOG"
expect "apply-env: the output shows no secret value" \
  bash -c '[[ $0 != *sk_live* && $0 != *ghs_* && $0 != *whsec_* && $0 != *eyJ* ]]' "$OUT"

# Re-running with the same payload is harmless.
run_env "$(good_payload)"
expect "apply-env: running it twice works" bash -c '[[ $0 == 0 ]]' "$RC"

# The login is optional.
new_env_case
run_env "$(good_payload | grep -v '^GHCR_')"
expect "apply-env: without GHCR_TOKEN no login is attempted" \
  bash -c '[[ $0 == 0 ]] && ! grep -q login "$1"' "$RC" "$STUB_LOG"

new_env_case
export STUB_FAIL_LOGIN=1
run_env "$(good_payload)"
expect "apply-env: a failed docker login exits 1 and says so" \
  bash -c '[[ $0 == 1 && $1 == *"docker login"*FAILED* ]]' "$RC" "$OUT"
unset STUB_FAIL_LOGIN

# Refusals: each leaves the directory without any file.
refuse_env() { # refuse_env <name> <payload> [text the message must hold]
  new_env_case
  run_env "$2"
  expect "apply-env refuses: $1" \
    bash -c '[[ $0 == 1 && $1 == *refused* ]]' "$RC" "$OUT"
  expect "apply-env wrote nothing: $1" nothing_written
  if [[ -n ${3-} ]]; then
    expect "apply-env message for [$1] names $3" bash -c '[[ $0 == *"$1"* ]]' "$OUT" "$3"
  fi
}
refuse_env "an empty payload" ""
refuse_env "an unknown key" "$(good_payload)
LD_PRELOAD=/tmp/x.so" "LD_PRELOAD"
refuse_env "a lowercase key" "$(good_payload)
path=/bin"
refuse_env "a line without =" "$(good_payload)
JUSTWORDS"
refuse_env "a duplicate key" "$(good_payload)
STORE_NAME=Other" "STORE_NAME"
refuse_env "a missing required key" "$(good_payload | grep -v '^JWT_SECRET=')" "JWT_SECRET"
refuse_env "an empty required key" "$(good_payload | sed 's/^STRIPE_API_KEY=.*/STRIPE_API_KEY=/')" "STRIPE_API_KEY"
refuse_env 'a $ in a value' "$(good_payload | sed 's/^JWT_SECRET=.*/JWT_SECRET=abc$HOME/')" "JWT_SECRET"
refuse_env "a double quote in a value" "$(good_payload | sed 's/^COOKIE_SECRET=.*/COOKIE_SECRET=ab"cd/')" "COOKIE_SECRET"
refuse_env "a single quote in a value" "$(good_payload | sed "s/^STORE_NAME=.*/STORE_NAME=Az'ira/")" "STORE_NAME"
refuse_env "a backslash in a value" "$(good_payload | sed 's/^STORE_NAME=.*/STORE_NAME=Az\\\\ira/')" "STORE_NAME"
refuse_env "a backtick in a value" "$(good_payload | sed 's/^STORE_NAME=.*/STORE_NAME=Az`id`ira/')" "STORE_NAME"
refuse_env "a carriage return in a value" "$(good_payload | sed 's/^STORE_NAME=.*/STORE_NAME=Azira\r/')" "STORE_NAME"
refuse_env "a trailing space" "$(good_payload | sed 's/^STORE_NAME=.*/STORE_NAME=Azira /')" "STORE_NAME"
refuse_env "a ' #' comment" "$(good_payload | sed 's/^STORE_NAME=.*/STORE_NAME=Azira # x/')" "STORE_NAME"
refuse_env "DB_SSL not true" "$(good_payload | sed 's/^DB_SSL=.*/DB_SSL=false/')" "DB_SSL"
refuse_env "a different CA path" "$(good_payload | sed 's#^DB_CA_PATH=.*#DB_CA_PATH=/etc/ssl/other.crt#')" "DB_CA_PATH"
refuse_env "FILE_PROVIDER local" "$(good_payload | sed 's/^FILE_PROVIDER=.*/FILE_PROVIDER=local/')" "FILE_PROVIDER"
refuse_env "a REDIS_URL pointing elsewhere" "$(good_payload | sed 's#^REDIS_URL=.*#REDIS_URL=redis://evil.example:6379#')" "REDIS_URL"
refuse_env "a short redis password" "$(good_payload | sed 's/^REDIS_PASSWORD=.*/REDIS_PASSWORD=short/')" "REDIS_PASSWORD"
refuse_env "a non-https image host" "$(good_payload | sed 's#^BACKEND_IMAGE=.*#BACKEND_IMAGE=evil.example/x/y#')" "BACKEND_IMAGE"
refuse_env "an image with a tag" "$(good_payload | sed 's#^BACKEND_IMAGE=.*#BACKEND_IMAGE=ghcr.io/Azira-Owner/azira-backend:latest#')" "BACKEND_IMAGE"
refuse_env "a CA that is not base64" "$(good_payload | sed 's#^DB_CA_CERT_B64=.*#DB_CA_CERT_B64=!!!notbase64!!!#')" "DB_CA_CERT_B64"
refuse_env "a CA that is not a certificate" "$(good_payload | sed "s#^DB_CA_CERT_B64=.*#DB_CA_CERT_B64=$(printf 'hello' | base64)#")" "DB_CA_CERT_B64"
refuse_env "a bad tunnel token" "$(good_payload | sed 's/^TUNNEL_TOKEN=.*/TUNNEL_TOKEN=short/')" "TUNNEL_TOKEN"
refuse_env "a GHCR_TOKEN without a user" "$(good_payload | grep -v '^GHCR_USER=')" "GHCR_USER"
refuse_env "too many lines" "$(good_payload; for i in $(seq 1 130); do echo "X$i=1"; done)"
refuse_env "an oversized payload" "$(good_payload; head -c 70000 /dev/zero | tr '\0' 'a')"

# A refused payload leaves an earlier good setup untouched.
new_env_case
run_env "$(good_payload)"
before=$(cat "$ESHOP/.env")
run_env "$(good_payload | sed 's/^STORE_NAME=.*/STORE_NAME=Az$ira/')"
expect "apply-env: a refused payload leaves the previous .env as it was" \
  bash -c '[[ $0 == 1 && $(cat "$1/.env") == "$2" ]]' "$RC" "$ESHOP" "$before"

# --- the files stay LF and executable ----------------------------------------
for f in "$APPLY_SH" "$DEPLOY_SH" "$GATE_SH"; do
  check "no CR characters in $(basename "$f")" bash -c '[[ $(tr -cd "\r" <"$0" | wc -c) -eq 0 ]]' "$f"
  check "$(basename "$f") passes bash -n" bash -n "$f"
done

echo
echo "$pass passed, $fail failed"
((fail == 0))
