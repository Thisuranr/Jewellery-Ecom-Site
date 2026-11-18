#!/usr/bin/env bash
# Encrypted Postgres backup.
#
#   pg_dump -Fc --schema=public     postgres:17 client in Docker, TLS verify-full
#     | age -r <public recipient>   the private key is offline, never on this host
#     | rclone rcat                 R2 azira-db-backups/<yyyy>/<mm>/<UTC stamp>.dump.age
#
# The dump only exists encrypted: no plaintext file is ever written. The object
# is uploaded as "<key>.partial", its size is checked, and only then is it
# copied to its final name, so a half-written backup never carries one. On success the
# script pings BACKUP_HEARTBEAT_URL; on any failure it pings BACKUP_HEARTBEAT_URL/fail.
#
# Configuration comes from the environment (systemd: EnvironmentFile=/opt/azira/backup.env).
# backup.env.example lists every variable. BACKUP_TARGET=file:///abs/dir writes
# to a local directory instead of R2 (local tests and the [Docker] round trip).
set -Eeuo pipefail
umask 077

readonly DEFAULT_PG_IMAGE="postgres:17.11-bookworm@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5"

partial=""   # where the upload is being written; removed again if the run fails
final=""
target_kind=""

log() { printf '%s backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

require() {
  local v
  for v in "$@"; do
    [[ -n "${!v:-}" ]] || die "$v is not set"
  done
}

# The URL holds the heartbeat token, so it goes to curl on stdin, not in argv.
heartbeat() { # $1: "" on success, "/fail" on failure
  if [[ -z "${BACKUP_HEARTBEAT_URL:-}" ]]; then
    log "BACKUP_HEARTBEAT_URL is not set; no heartbeat sent"
    return 0
  fi
  printf 'url = "%s%s"\n' "${BACKUP_HEARTBEAT_URL%/}" "$1" \
    | curl -fsS -m 10 --retry 3 -o /dev/null -K - \
    || log "heartbeat ping failed"
}

record() { # one line per run in BACKUP_LOG
  local file="${BACKUP_LOG:-/opt/azira/backup.log}"
  printf '%s %s key=%s bytes=%s seconds=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "${final:-none}" "${2:-0}" "$SECONDS" \
    >>"$file" 2>/dev/null || log "could not append to $file"
}

remove_partial() {
  [[ -n "$partial" ]] || return 0
  case "$target_kind" in
    r2) rclone deletefile "$partial" >/dev/null 2>&1 || true ;;
    file) rm -f -- "$partial" ;;
  esac
}

on_exit() {
  local status=$?
  trap - EXIT
  if (( status != 0 )); then
    remove_partial || true
    record FAILED || true
    heartbeat /fail || true
    log "backup FAILED (exit $status)"
  fi
  exit "$status"
}
trap on_exit EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

# ---- configuration -----------------------------------------------------------

require PGHOST PGUSER PGPASSWORD BACKUP_AGE_RECIPIENT
export PGHOST PGUSER PGPASSWORD
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-postgres}"
export PGSSLMODE="${PGSSLMODE:-verify-full}"

[[ "$BACKUP_AGE_RECIPIENT" =~ ^age1[0-9a-z]+$ ]] \
  || die "BACKUP_AGE_RECIPIENT is not an age public key (age1...)"

min_bytes="${BACKUP_MIN_BYTES:-102400}"
[[ "$min_bytes" =~ ^[0-9]+$ ]] || die "BACKUP_MIN_BYTES must be a whole number"

pg_image="${BACKUP_PG_IMAGE:-$DEFAULT_PG_IMAGE}"
ca="${BACKUP_PG_CA:-/opt/azira/certs/supabase-ca.crt}"
docker_tls=()
case "$PGSSLMODE" in
  verify-full)
    [[ -r "$ca" ]] || die "BACKUP_PG_CA ($ca) is not readable"
    docker_tls=(-v "$ca:/run/secrets/pg-ca.crt:ro" -e PGSSLROOTCERT=/run/secrets/pg-ca.crt)
    ;;
  *)
    # Anything below verify-ca accepts any server certificate, and verify-ca
    # skips the host name check: Supabase's CA signs every project's
    # certificate, so it would accept any Supabase server.
    [[ "${BACKUP_ALLOW_INSECURE_TLS:-}" == 1 ]] \
      || die "PGSSLMODE=$PGSSLMODE does not verify the server; use verify-full"
    log "WARNING: PGSSLMODE=$PGSSLMODE (BACKUP_ALLOW_INSECURE_TLS=1, local tests only)"
    ;;
esac

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
key="${stamp:0:4}/${stamp:4:2}/${stamp}.dump.age"

target="${BACKUP_TARGET:-r2}"
case "$target" in
  r2)
    target_kind=r2
    remote="${BACKUP_RCLONE_REMOTE:-r2:azira-db-backups}"
    final="$remote/$key"
    ;;
  file:///*)
    target_kind="file"
    dir="${target#file://}"
    final="$dir/$key"
    mkdir -p -- "$(dirname -- "$final")"
    ;;
  *) die "BACKUP_TARGET must be r2 or file:///absolute/path" ;;
esac
partial="$final.partial"

# ---- stages ------------------------------------------------------------------

dump() {
  # -e NAME without a value passes the variable through, so the password never
  # appears in a process list. Host networking by default: the droplet's own
  # IPv6 and IPv4. The local [Docker] check joins the compose network instead
  # (BACKUP_DOCKER_NETWORK). --log-driver none: an attached container's stdout
  # also goes to the daemon's log driver (json-file, under /var/lib/docker), so
  # without it the plaintext dump would be written to disk (X5 #1).
  docker run --rm --log-driver none --network "${BACKUP_DOCKER_NETWORK:-host}" \
    -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE \
    "${docker_tls[@]}" \
    "$pg_image" \
    pg_dump --format=custom --schema=public --lock-wait-timeout=120s
}

encrypt() { age -r "$BACKUP_AGE_RECIPIENT"; }

upload() {
  case "$target_kind" in
    r2) rclone rcat --s3-no-check-bucket "$partial" ;;
    file) cat >"$partial" ;;
  esac
}

uploaded_size() {
  case "$target_kind" in
    r2) rclone lsf --format s "$partial" ;;
    file) wc -c <"$partial" | tr -d ' ' ;;
  esac
}

promote() {
  case "$target_kind" in
    r2)
      # S3 has no rename: copy server-side, then delete the .partial. With the
      # bucket lock rule (infra/cloudflare/r2.md) R2 refuses every delete; the
      # backup is complete under its final name by then, so that is only
      # logged, and the lifecycle rule removes the .partial copy (X5 #2).
      rclone copyto --s3-no-check-bucket "$partial" "$final" || return 1
      if ! rclone deletefile "$partial" >/dev/null 2>&1; then
        log "could not delete $partial (bucket lock?); the 35-day lifecycle rule removes it"
      fi
      ;;
    file) mv -f -- "$partial" "$final" ;;
  esac
}

# ---- run ---------------------------------------------------------------------

log "starting: ${PGHOST}:${PGPORT}/${PGDATABASE} -> $final"

set +e
dump | encrypt | upload
status=("${PIPESTATUS[@]}")
set -e
(( status[0] == 0 )) || die "pg_dump failed (exit ${status[0]})"
(( status[1] == 0 )) || die "age failed (exit ${status[1]})"
(( status[2] == 0 )) || die "upload failed (exit ${status[2]})"

size="$(uploaded_size)" || die "could not read the size of the uploaded object"
size="${size//[[:space:]]/}"
[[ "$size" =~ ^[0-9]+$ ]] || die "could not read the size of the uploaded object"
(( size >= min_bytes )) || die "backup is only $size bytes (minimum $min_bytes)"

promote || die "could not copy $partial to its final name"
partial=""

record OK "$size"
heartbeat ""
log "done: $final ($size bytes, ${SECONDS}s)"
