#!/usr/bin/env bash
# Restore an age-encrypted backup into a scratch database.
#
#   restore.sh <file.dump.age | yyyy/mm/<stamp>.dump.age | latest> <target DATABASE_URL>
#
# Refuses unless the target database name ends in "_restore" and the host is
# local (localhost, 127.0.0.1, ::1) or listed in RESTORE_ALLOWED_HOSTS (the
# scratch Supabase project). A real disaster recovery into another database
# needs RESTORE_CONFIRM_TARGET="<host>/<dbname>" spelled exactly. The target
# must exist and its public schema must be empty.
#
# Environment:
#   AGE_IDENTITY            the offline private key file (required)
#   PGPASSWORD              the target's password (keep it out of the URL)
#   RESTORE_RCLONE_REMOTE   where object keys are read from (default r2:azira-db-backups)
#   RESTORE_ALLOWED_HOSTS   extra target hosts, space separated
#   RESTORE_CONFIRM_TARGET  "<host>/<dbname>": allow exactly this other target
#   PGSSLMODE, PGSSLROOTCERT  verify-full and the target's CA: required for any
#                           target that is not localhost, 127.0.0.1 or ::1
#   RESTORE_ALLOW_INSECURE_TLS  1 lifts that for a local Docker network host
#                           (the [Docker] drill's "postgres"); never for a real one
#   RESTORE_EXT_SCHEMA      schema for pg_trgm and unaccent when the dump names
#                           none (default extensions, as on Supabase)
#   RESTORE_PG_IMAGE        run pg_restore and psql in this Docker image (for
#                           example the pinned postgres:17 image from backup.sh)
#                           instead of from PATH
#   RESTORE_DOCKER_NETWORK  network for that container (default host)
#   RESTORE_WORKDIR        parent of the private temp dir that holds the
#                           decrypted dump while the restore runs (default $TMPDIR)
#
# Steps: fetch, decrypt (age -d -i), read the archive's table of contents,
# create the extensions in the schema the dump refers to, pg_restore
# --no-owner --no-acl in one transaction, ANALYZE, then print row counts.
set -Eeuo pipefail
umask 077

readonly ROW_COUNT_TABLES=(product order customer payment)

log() { printf '%s restore: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

usage() {
  die "usage: restore.sh <file.dump.age | yyyy/mm/<stamp>.dump.age | latest> <target DATABASE_URL>"
}

# SQL identifier: bare when it is already a plain lower-case name, quoted otherwise.
qi() {
  if [[ "$1" =~ ^[a-z_][a-z0-9_]*$ ]]; then
    printf '%s' "$1"
  else
    printf '"%s"' "${1//\"/\"\"}"
  fi
}

work=""
cleanup() {
  local status=$?
  trap - EXIT
  [[ -n "$work" ]] && rm -rf -- "$work"
  (( status == 0 )) || log "restore FAILED (exit $status)"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

(( $# == 2 )) || usage
source_ref="$1"
url="$2"

# ---- target guard ------------------------------------------------------------

url_re='^postgres(ql)?://([^@/?#]*@)?(\[[^]/?#]*\]|[^]:/?#[]*)(:[0-9]+)?/([^/?#]+)(\?[^#]*)?$'
[[ "$url" =~ $url_re ]] || die "the target must be a postgres:// URL with a host and a database name"
userinfo="${BASH_REMATCH[2]}"
host="${BASH_REMATCH[3]}"
dbname="${BASH_REMATCH[5]}"
query="${BASH_REMATCH[6]}"
host="${host#[}"
host="${host%]}"

[[ -n "$host" ]] || die "the target URL must name its host (an empty host would fall back to PGHOST)"
[[ "$dbname" =~ ^[A-Za-z0-9_-]+$ ]] || die "unexpected characters in the database name"
if [[ -n "$query" ]]; then
  # host=, hostaddr=, service= or dbname= in the query string would override the checked values.
  IFS='&' read -r -a params <<<"${query#\?}"
  for p in "${params[@]}"; do
    case "${p%%=*}" in
      sslmode|sslrootcert|connect_timeout|application_name) ;;
      *) die "URL parameter '${p%%=*}' is not allowed in the target" ;;
    esac
  done
fi
[[ "$userinfo" != *:* ]] || log "WARNING: the URL holds a password; prefer PGPASSWORD"

allowed=0
if [[ -n "${RESTORE_CONFIRM_TARGET:-}" ]]; then
  [[ "$RESTORE_CONFIRM_TARGET" == "$host/$dbname" ]] \
    || die "RESTORE_CONFIRM_TARGET does not match the target ($host/$dbname)"
  log "WARNING: restoring into $host/$dbname on explicit confirmation"
  allowed=1
elif [[ "$dbname" == *_restore ]]; then
  case "$host" in
    localhost|127.0.0.1|::1) allowed=1 ;;
    *)
      read -r -a extra_hosts <<<"${RESTORE_ALLOWED_HOSTS:-}"
      for h in "${extra_hosts[@]}"; do
        if [[ "$host" == "$h" ]]; then allowed=1; fi
      done
      ;;
  esac
fi
(( allowed == 1 )) || die "refusing $host/$dbname: the name must end in _restore and the host must be local or in RESTORE_ALLOWED_HOSTS"

# The restore sends every row of the decrypted backup to the target. To any
# host but this machine that needs verified TLS, as backup.sh requires:
# libpq's default (prefer) and require accept any certificate. In libpq the
# URL's sslmode= wins over PGSSLMODE (X5 #3).
case "$host" in
  localhost|127.0.0.1|::1) ;;
  *)
    sslmode="${PGSSLMODE:-prefer}"
    if [[ -n "$query" ]]; then
      for p in "${params[@]}"; do
        if [[ "${p%%=*}" == sslmode ]]; then sslmode="${p#*=}"; fi
      done
    fi
    if [[ "$sslmode" != verify-full ]]; then
      [[ "${RESTORE_ALLOW_INSECURE_TLS:-}" == 1 ]] \
        || die "$host is not this machine, so the restore must use sslmode=verify-full: set PGSSLMODE=verify-full and PGSSLROOTCERT to the target's CA (and no other sslmode in the URL)"
      log "WARNING: no verified TLS to $host (RESTORE_ALLOW_INSECURE_TLS=1, a local Docker network only)"
    fi
    ;;
esac

# ---- tools -------------------------------------------------------------------

require_cmd() {
  local c
  for c in "$@"; do
    command -v "$c" >/dev/null 2>&1 || die "$c is not installed"
  done
}

require_cmd age
[[ -n "${AGE_IDENTITY:-}" ]] || die "AGE_IDENTITY is not set (the offline private key file)"
[[ -r "$AGE_IDENTITY" ]] || die "AGE_IDENTITY ($AGE_IDENTITY) is not readable"
if [[ -n "${RESTORE_PG_IMAGE:-}" ]]; then
  require_cmd docker
else
  require_cmd pg_restore psql
fi

work="$(mktemp -d "${RESTORE_WORKDIR:-${TMPDIR:-/tmp}}/restore.XXXXXX")"

# pg_restore / psql, natively or in the pinned image. The work dir is mounted
# at the same path, so file arguments are identical inside the container.
pg() {
  if [[ -n "${RESTORE_PG_IMAGE:-}" ]]; then
    local -a ca=()
    if [[ -n "${PGSSLROOTCERT:-}" ]]; then ca=(-v "$PGSSLROOTCERT:$PGSSLROOTCERT:ro"); fi
    # --log-driver none: nothing a container prints is kept under /var/lib/docker.
    docker run --rm -i --log-driver none --network "${RESTORE_DOCKER_NETWORK:-host}" -e PGPASSWORD -e PGSSLMODE -e PGSSLROOTCERT \
      "${ca[@]}" -v "$work:$work" "$RESTORE_PG_IMAGE" "$@"
  else
    "$@"
  fi
}

sql() { pg psql -X -q -At -v ON_ERROR_STOP=1 -d "$url" -c "$1"; }

# ---- fetch and decrypt -------------------------------------------------------

started=$SECONDS
remote="${RESTORE_RCLONE_REMOTE:-r2:azira-db-backups}"
if [[ -f "$source_ref" ]]; then
  enc="$source_ref"
else
  require_cmd rclone
  if [[ "$source_ref" == latest ]]; then
    source_ref="$(rclone lsf -R --files-only --include '*.dump.age' "$remote" | sort | tail -n 1)"
    [[ -n "$source_ref" ]] || die "no backups found in $remote"
  fi
  [[ "$source_ref" =~ ^[0-9]{4}/[0-9]{2}/[0-9]{8}T[0-9]{6}Z\.dump\.age$ ]] \
    || die "$source_ref is neither a local file nor a backup key (yyyy/mm/<stamp>.dump.age)"
  enc="$work/backup.dump.age"
  log "downloading $remote/$source_ref"
  rclone copyto "$remote/$source_ref" "$enc" || die "download failed"
fi

dump="$work/backup.dump"
log "decrypting $(basename -- "$source_ref")"
age -d -i "$AGE_IDENTITY" -o "$dump" "$enc" \
  || die "decryption failed: wrong key, or the object is truncated or corrupted"

pg pg_restore -l "$dump" >"$work/toc.list" \
  || die "the decrypted file is not a readable pg_dump archive"

# ---- target checks -----------------------------------------------------------

tables="$(sql "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p','v','m','S','f')")" \
  || die "cannot connect to $host/$dbname (create it first; see docs/hosting.md (Backups))"
[[ "$tables" == 0 ]] || die "$host/$dbname is not empty ($tables relations in public); drop and recreate it"

# ---- extensions --------------------------------------------------------------
# pg_dump --schema=public leaves out extensions, but public objects refer to
# them schema-qualified: the medusa_search_lk and medusa_search_english
# mappings name <schema>.unaccent, and the search index's GIN index names
# <schema>.gin_trgm_ops. Supabase keeps extensions in "extensions"; a local
# Postgres keeps them in "public". Create them where the dump expects them.

ext_schemas="$(pg pg_restore --schema-only -f - "$dump" \
  | grep -oE '[A-Za-z_][A-Za-z0-9_]*\.(unaccent|gin_trgm_ops|gist_trgm_ops)\b' \
  | cut -d. -f1 | grep -vx 'pg_catalog' | sort -u || true)"
case "$(printf '%s' "$ext_schemas" | grep -c . || true)" in
  0) ext_schema="${RESTORE_EXT_SCHEMA:-extensions}" ;;
  1)
    ext_schema="$ext_schemas"
    if [[ -n "${RESTORE_EXT_SCHEMA:-}" && "$RESTORE_EXT_SCHEMA" != "$ext_schema" ]]; then
      die "the dump refers to $ext_schema.unaccent/gin_trgm_ops, not RESTORE_EXT_SCHEMA=$RESTORE_EXT_SCHEMA"
    fi
    ;;
  *) die "the dump refers to extension objects in several schemas: $(echo "$ext_schemas" | tr '\n' ' ')" ;;
esac
log "extensions schema: $ext_schema"

ext="$(qi "$ext_schema")"
sql "CREATE SCHEMA IF NOT EXISTS $ext; CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA $ext; CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA $ext;" \
  || die "could not create the extensions"

placed="$(sql "select string_agg(extname || '=' || extnamespace::regnamespace::text, ' ' order by extname) from pg_extension where extname in ('pg_trgm','unaccent')")"
[[ "$placed" == "pg_trgm=$ext unaccent=$ext" ]] \
  || die "extensions already exist in another schema ($placed); use a fresh database"

if [[ "$ext_schema" != public ]]; then
  # Medusa calls word_similarity() and the trigram operators unqualified, so the
  # app needs the extensions schema on its search_path, as Supabase's roles have.
  # shellcheck disable=SC2016 # "$user" is SQL, not a shell variable
  sql "$(printf 'ALTER DATABASE %s SET search_path TO "$user", public, %s;' "$(qi "$dbname")" "$ext")"
fi

# ---- restore -----------------------------------------------------------------
# With --schema=public, pg_dump records "CREATE SCHEMA public", which already
# exists in the target; drop that entry (and its comment) from the list.

grep -vE '^[0-9]+; [0-9]+ [0-9]+ (SCHEMA - public|COMMENT - SCHEMA public) ' \
  "$work/toc.list" >"$work/restore.list" || true
skipped=$(( $(grep -c . "$work/toc.list" || true) - $(grep -c . "$work/restore.list" || true) ))
log "restoring $(grep -cvE '^;' "$work/restore.list" || true) archive entries ($skipped schema entries skipped)"

pg pg_restore --no-owner --no-acl --single-transaction --exit-on-error \
  -L "$work/restore.list" -d "$url" "$dump" \
  || die "pg_restore failed; nothing was committed"

sql "ANALYZE;" || die "ANALYZE failed"

# ---- report ------------------------------------------------------------------

in_list="$(printf "'%s'," "${ROW_COUNT_TABLES[@]}")"
counts="$(sql "select t || '=' || case when to_regclass(format('public.%I', t)) is null then 'absent' else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t), false, true, '')))[1]::text end from unnest(array[${in_list%,}]) as t")"
latest="$(sql "select case when to_regclass('public.\"order\"') is null then 'absent' else coalesce((xpath('/row/m/text()', query_to_xml('select max(created_at) as m from public.\"order\"', false, true, '')))[1]::text, 'none') end")"

log "restored $(basename -- "$source_ref") into $host/$dbname in $(( SECONDS - started ))s"
printf 'object: %s\n' "$(basename -- "$source_ref")"
printf 'target: %s/%s\n' "$host" "$dbname"
printf 'seconds: %s\n' "$(( SECONDS - started ))"
printf 'rows: %s\n' "${counts//$'\n'/ }"
printf 'latest_order_created_at: %s\n' "$latest"
