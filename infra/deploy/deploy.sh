#!/usr/bin/env bash
# deploy.sh <40-hex commit sha> [--now]
#
# Deploys the backend image ${BACKEND_IMAGE}:<sha>: pull, migrate in a one-off
# container, swap the app container, health-check it for up to 120 s, and roll
# the app back to the previous tag if it doesn't become healthy. Migrations are
# never rolled back, so every migration must work with the previous image too
# (expand, then contract; docs/hosting.md, "Rolling back").
#
# Installed as /opt/azira/bin/deploy.sh (root:root, 0755). It runs as root:
# through `sudo -n` from deploy-gate.sh (the `deploy` SSH user's forced
# command), or by the owner with sudo. The `deploy` user is not in the docker
# group, so this script is its only way to touch Docker.
#
# Only the pinned image runs. /opt/azira/image-pin.env (root:root, written by
# infra/vps/bootstrap.sh) names the one allowed repository, BACKEND_IMAGE_REPO;
# the image the compose file resolves to must be exactly that repository, or
# deploy.sh refuses before pulling anything. Without the pin file it refuses too.
#
# redis and cloudflared are left running as they are, unless the settings they
# read changed: a hash of redis.env and tunnel.env is kept in
# /opt/azira/service-env.sha256 after each successful start, and a service whose
# file no longer matches (or has no recorded hash) is recreated, so a rotated
# REDIS_PASSWORD or TUNNEL_TOKEN takes effect and the new app container can
# still reach redis. (While redis is being replaced the old app container loses
# its redis connection; it is swapped after the migration, minutes later.)
#
# Exit codes: 0 deployed; 1 refused or failed (the previous app still runs, or
# none did); 2 the rollback failed too and the app is down.
#
# What it prints goes back over SSH into the GitHub Actions log, so it prints
# step names and statuses only. Docker's own output (pull, migrations) goes to
# /opt/azira/logs/deploy-<time>-<sha12>.log on the droplet.

set -euo pipefail
umask 027
export LC_ALL=C

# --- settings: infra/deploy/tests/run.sh rewrites only the lines in this block
SHOP_DIR=/opt/azira
COMPOSE_DIR=/opt/azira/compose
HEALTH_TIMEOUT=120
HEALTH_INTERVAL=3
REQUIRE_ROOT=1
DEPLOY_WINDOW=
DOCKER_CONFIG=/root/.docker
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# --- end of settings
export PATH DOCKER_CONFIG
readonly SHOP_DIR COMPOSE_DIR HEALTH_TIMEOUT HEALTH_INTERVAL REQUIRE_ROOT DEPLOY_WINDOW

readonly COMPOSE_FILE="$COMPOSE_DIR/docker-compose.prod.yml"
readonly TAG_FILE="$SHOP_DIR/current_tag"
readonly LOCK_FILE="$SHOP_DIR/deploy.lock"
readonly DEPLOY_LOG="$SHOP_DIR/deploy.log"
readonly PIN_FILE="$SHOP_DIR/image-pin.env"
readonly ENV_HASH_FILE="$SHOP_DIR/service-env.sha256"
readonly RUN_LOG_DIR="$SHOP_DIR/logs"
readonly SHA_RE='^[0-9a-f]{40}$'
readonly KEEP_TAGS=3
readonly KEEP_RUN_LOGS=30

RUN_LOG=/dev/null
STEP="checks"
FINISHED=0

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# One line to stdout and to deploy.log. Messages never contain secrets or raw
# input: only shas that passed SHA_RE, step names and statuses.
record() {
  local line
  line="$(ts) $*"
  printf '%s\n' "$line"
  printf '%s\n' "$line" >>"$DEPLOY_LOG" || true
}

finish() { # finish <exit code> <message>
  record "$2"
  FINISHED=1
  exit "$1"
}

refuse() { finish 1 "refused: $*"; }

on_exit() {
  local rc=$?
  if [[ $FINISHED != 1 ]]; then
    record "aborted: unexpected error during '$STEP' (exit $rc); see $RUN_LOG"
  fi
}
trap on_exit EXIT

# Runs a command with its output in the per-deploy log only.
quiet() { "$@" >>"$RUN_LOG" 2>&1; }

# docker compose for this stack, with IMAGE_TAG set for the ${...} in the file.
dc() { # dc <image tag> <compose args...>
  local tag=$1
  shift
  IMAGE_TAG=$tag docker compose --project-directory "$COMPOSE_DIR" -f "$COMPOSE_FILE" "$@"
}

# The backend image reference for a tag, from the compose file itself.
backend_ref() { # backend_ref <tag>
  dc "$1" config --images 2>>"$RUN_LOG" |
    awk -v suffix=":$1" '!found && substr($0, length($0) - length(suffix) + 1) == suffix { print; found = 1 }'
}

# The pinned image repository from the root-owned pin file (nothing if absent).
pinned_repo() {
  local line
  line=$(grep -m1 -E '^BACKEND_IMAGE_REPO=' "$PIN_FILE" 2>/dev/null || true)
  printf '%s' "${line#*=}"
}

# hash of a settings file, or nothing when it is missing
env_hash() { # env_hash <file name under SHOP_DIR>
  sha256sum "$SHOP_DIR/$1" 2>/dev/null | awk '{ print $1 }'
}

recorded_hash() { # recorded_hash <service>
  awk -v n="$1" '$1 == n { print $2 }' "$ENV_HASH_FILE" 2>/dev/null || true
}

# Polls the medusa container until it runs <tag> and Docker reports it
# healthy (0), unhealthy (1), or HEALTH_TIMEOUT passes (1).
wait_healthy() { # wait_healthy <tag>
  local tag=$1 deadline cid image status
  deadline=$((SECONDS + HEALTH_TIMEOUT))
  while ((SECONDS < deadline)); do
    cid=$(dc "$tag" ps -q medusa 2>>"$RUN_LOG" || true)
    if [[ -n $cid ]]; then
      image=$(docker inspect --format '{{.Config.Image}}' "$cid" 2>>"$RUN_LOG" || true)
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>>"$RUN_LOG" || true)
      if [[ $image == *":$tag" ]]; then
        case $status in
          healthy) return 0 ;;
          unhealthy) return 1 ;;
        esac
      fi
    fi
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

# The last KEEP_TAGS distinct tags deployed successfully, newest first.
keep_tags() {
  [[ -f $DEPLOY_LOG ]] || return 0
  awk '$2 == "deployed" { sub(/^sha=/, "", $3); print $3 }' "$DEPLOY_LOG" |
    tac | awk -v n="$KEEP_TAGS" '!seen[$0]++ && c < n { print; c++ }'
}

# Removes this repository's sha-tagged images except the last KEEP_TAGS
# deployed ones. Never fails the deploy.
prune_images() { # prune_images <repository>
  local repo=$1 ref tag
  local -a keep
  mapfile -t keep < <(keep_tags)
  while IFS= read -r ref; do
    tag=${ref##*:}
    [[ $tag =~ $SHA_RE ]] || continue
    if ! printf '%s\n' "${keep[@]}" | grep -qxF -- "$tag"; then
      quiet docker image rm "$ref" || true
    fi
  done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' "$repo" 2>>"$RUN_LOG" || true)
}

prune_run_logs() {
  local -a logs
  mapfile -t logs < <(find "$RUN_LOG_DIR" -maxdepth 1 -type f -name 'deploy-*.log' | sort)
  if ((${#logs[@]} > KEEP_RUN_LOGS)); then
    rm -f -- "${logs[@]:0:${#logs[@]}-KEEP_RUN_LOGS}"
  fi
}

# Puts PREV back after a failed start, or stops the new container when there
# is no PREV (first deploy). Always exits.
roll_back() { # roll_back <sha> <prev>
  local sha=$1 prev=$2
  if [[ -z $prev ]]; then
    STEP="stop failed first deploy"
    quiet dc "$sha" stop medusa || true
    finish 1 "failed sha=$sha: not healthy within ${HEALTH_TIMEOUT}s; first deploy, no previous tag; medusa stopped"
  fi
  STEP="roll back"
  record "rolling back to prev=$prev"
  if quiet dc "$prev" up -d --no-deps medusa && wait_healthy "$prev"; then
    finish 1 "rolled back sha=$sha prev=$prev: the app runs $prev again; migrations from $sha stay applied"
  fi
  finish 2 "ROLLBACK FAILED sha=$sha prev=$prev: medusa is not healthy; follow docs/hosting.md now"
}

main() {
  local sha now=0 offset hour prev="" ref label

  # 1. Arguments. Nothing from the command line is echoed back.
  case $# in
    1) sha=$1 ;;
    2)
      sha=$1
      [[ $2 == --now ]] || refuse "unknown option; usage: deploy.sh <40-hex sha> [--now]"
      now=1
      ;;
    *) refuse "usage: deploy.sh <40-hex sha> [--now]" ;;
  esac
  [[ $sha =~ $SHA_RE ]] || refuse "the tag must be a full 40-character lowercase hex commit sha"
  if [[ $REQUIRE_ROOT == 1 && $EUID -ne 0 ]]; then
    refuse "run as root (sudo)"
  fi

  # 2. One deploy at a time.
  exec 9>"$LOCK_FILE"
  flock -n 9 || refuse "another deploy is running (lock $LOCK_FILE)"

  # 3. Optional deploy window (settings block: DEPLOY_WINDOW="02-05", Sydney
  #    time). Empty, the production setting, means any time: deploys start from
  #    a push to main. With a window set, --now overrides it.
  if [[ -n $DEPLOY_WINDOW ]]; then
    [[ $DEPLOY_WINDOW =~ ^([0-9]{2})-([0-9]{2})$ ]] || refuse "DEPLOY_WINDOW must look like 02-05"
    local from=$((10#${BASH_REMATCH[1]})) to=$((10#${BASH_REMATCH[2]}))
    offset=$(TZ=Australia/Sydney date +%z)
    [[ $offset == "+1000" || $offset == "+1100" ]] || refuse "cannot read Australia/Sydney time (tzdata missing?)"
    hour=$(TZ=Australia/Sydney date +%H)
    [[ $hour =~ ^[0-9]{2}$ ]] || refuse "cannot read the hour"
    if ((10#$hour < from || 10#$hour >= to)); then
      if ((now == 0)); then
        refuse "sha=$sha: outside the $DEPLOY_WINDOW Australia/Sydney deploy window (hour $hour); pass --now to deploy anyway"
      fi
      record "outside the deploy window (Australia/Sydney hour $hour); --now given, continuing"
    fi
  fi

  # 4. The tag running now, for rollback.
  if [[ -e $TAG_FILE ]]; then
    prev=$(tr -d '[:space:]' <"$TAG_FILE")
    [[ $prev =~ $SHA_RE ]] || refuse "$TAG_FILE does not hold a valid sha; fix it by hand first"
  fi

  mkdir -p "$RUN_LOG_DIR"
  RUN_LOG="$RUN_LOG_DIR/deploy-$(date -u +%Y%m%dT%H%M%SZ)-${sha:0:12}.log"
  : >"$RUN_LOG"
  record "start sha=$sha prev=${prev:-none} now=$now log=$RUN_LOG"

  # 5. The image must be the pinned one. Then pull, and check the image was
  #    built from this commit.
  STEP="image pin"
  local pin
  pin=$(pinned_repo)
  [[ -n $pin ]] || finish 1 "refused sha=$sha: $PIN_FILE is missing or has no BACKEND_IMAGE_REPO; nothing changed"
  ref=$(backend_ref "$sha" || true)
  [[ -n $ref ]] || finish 1 "failed sha=$sha: no image for this tag in $COMPOSE_FILE; nothing changed"
  [[ ${ref%:*} == "$pin" ]] || finish 1 "refused sha=$sha: the image is not the pinned repository; nothing changed"
  STEP="pull"
  quiet dc "$sha" pull medusa || finish 1 "failed sha=$sha: pull failed; nothing changed"
  label=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$ref" 2>>"$RUN_LOG" || true)
  [[ $label == "$sha" ]] || finish 1 "failed sha=$sha: the image's revision label does not match the tag; nothing changed"

  # 6. Redis and the tunnel: started when missing (first deploy), recreated when
  #    the settings file they read changed, otherwise left exactly as they are.
  STEP="redis and cloudflared"
  local -a changed=() same=()
  local svc file cur
  for svc in redis:redis.env cloudflared:tunnel.env; do
    file=${svc#*:}
    svc=${svc%%:*}
    cur=$(env_hash "$file")
    if [[ -z $cur || $cur != "$(recorded_hash "$svc")" ]]; then
      changed+=("$svc")
    else
      same+=("$svc")
    fi
  done
  if ((${#changed[@]} > 0)); then
    record "recreate ${changed[*]}: settings changed or not recorded yet"
    quiet dc "$sha" up -d --wait --wait-timeout 60 --no-deps --force-recreate "${changed[@]}" ||
      finish 1 "failed sha=$sha: ${changed[*]} did not come up with the new settings; fix them and deploy again"
  fi
  if ((${#same[@]} > 0)); then
    quiet dc "$sha" up -d --wait --wait-timeout 60 --no-deps --no-recreate "${same[@]}" ||
      finish 1 "failed sha=$sha: ${same[*]} did not start; the app was not changed"
  fi
  {
    printf 'redis %s\n' "$(env_hash redis.env)"
    printf 'cloudflared %s\n' "$(env_hash tunnel.env)"
  } >"$ENV_HASH_FILE.tmp"
  mv -f "$ENV_HASH_FILE.tmp" "$ENV_HASH_FILE"

  # 7. Migrations, in a one-off container. On failure the old app is still
  #    running and nothing else changed. stdin is closed: db:migrate asks
  #    before it drops or changes module link tables (a removed link, or a
  #    rollback across a Medusa upgrade), and that prompt must fail here, not
  #    wait invisibly on the terminal of an owner running this by hand.
  STEP="migrate"
  record "migrate sha=$sha"
  quiet dc "$sha" --profile migrate run --rm -T migrate </dev/null ||
    finish 1 "failed sha=$sha: migrations failed; the app still runs ${prev:-nothing}; see $RUN_LOG"

  # 8. Swap the app container and wait for its health check.
  STEP="start"
  record "start app sha=$sha"
  if ! quiet dc "$sha" up -d --no-deps medusa; then
    record "could not start sha=$sha"
    roll_back "$sha" "$prev"
  fi
  STEP="health check"
  if ! wait_healthy "$sha"; then
    record "unhealthy sha=$sha after up to ${HEALTH_TIMEOUT}s"
    roll_back "$sha" "$prev"
  fi

  # 9. Healthy: record it, then tidy up.
  STEP="record"
  printf '%s\n' "$sha" >"$TAG_FILE.tmp"
  mv -f "$TAG_FILE.tmp" "$TAG_FILE"
  record "deployed sha=$sha prev=${prev:-none}"
  STEP="prune"
  prune_images "${ref%:*}" || true
  prune_run_logs || true
  FINISHED=1
}

main "$@"
