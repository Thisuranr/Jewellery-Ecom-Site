#!/usr/bin/env bash
# Tests for backup.sh and restore.sh with the real age binary and stubs for
# docker, rclone, curl, pg_restore and psql (tests/stubs). They cover the
# pipeline, the checks, the heartbeats and the guards; the real pg_dump ->
# pg_restore round trip is the [Docker] step in docs/hosting.md (Backups).
#
# Needs bash, age and age-keygen on PATH. Usage: infra/backup/tests/run.sh
# shellcheck disable=SC2016 # the bash -c bodies expand $1 in the child shell
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scripts="$(dirname "$here")"
export PATH="$here/stubs:$PATH"

for c in age age-keygen; do
  command -v "$c" >/dev/null || { echo "$c is not on PATH" >&2; exit 2; }
done

tmp="$(cd "$(mktemp -d)" && pwd)"   # POSIX form on Git Bash too (file:///...)
trap 'rm -rf "$tmp"' EXIT
age-keygen -o "$tmp/key.txt" 2>/dev/null
age-keygen -o "$tmp/other-key.txt" 2>/dev/null
recipient="$(age-keygen -y "$tmp/key.txt")"
printf 'dummy CA\n' >"$tmp/ca.crt"

passed=0
failed=0
ok() { passed=$((passed + 1)); printf 'ok   %s\n' "$1"; }
not_ok() { failed=$((failed + 1)); printf 'FAIL %s\n' "$1"; }
check() { # description, then a command that must succeed
  local d="$1"; shift
  if "$@"; then ok "$d"; else not_ok "$d"; fi
}

case_dir() { # fresh stub state for one case
  STUB_LOG="$tmp/$1"
  STUB_R2="$STUB_LOG/r2"
  mkdir -p "$STUB_R2"
  : >"$STUB_LOG/heartbeats"
  export STUB_LOG STUB_R2
}

backup_env() {
  env -i PATH="$PATH" HOME="${HOME:-/tmp}" TMPDIR="$tmp" \
    PGHOST=db.example.supabase.co PGUSER=postgres PGPASSWORD=Pw0rdNotInArgv \
    BACKUP_AGE_RECIPIENT="$recipient" BACKUP_PG_CA="$tmp/ca.crt" \
    BACKUP_HEARTBEAT_URL=https://hb.example/api/v1/heartbeat/TOKEN \
    BACKUP_LOG="$STUB_LOG/backup.log" BACKUP_MIN_BYTES=1000 \
    STUB_LOG="$STUB_LOG" STUB_R2="$STUB_R2" "$@"
}

objects() { find "$1" -type f 2>/dev/null | sort; }

# ---- backup.sh ---------------------------------------------------------------

echo "# backup.sh"

case_dir b1
backup_env BACKUP_TARGET="file://$STUB_LOG/out" bash "$scripts/backup.sh" 2>"$STUB_LOG/err"
rc=$?
obj="$(objects "$STUB_LOG/out")"
check "file target: exits 0" test "$rc" -eq 0
check "file target: one object at yyyy/mm/<stamp>.dump.age, no .partial" \
  bash -c '[[ $(wc -l <<<"$1") == 1 && "$1" =~ /out/[0-9]{4}/[0-9]{2}/[0-9]{8}T[0-9]{6}Z\.dump\.age$ ]]' _ "$obj"
check "file target: object decrypts to the exact dump" \
  bash -c 'age -d -i "$1" "$2" | cmp -s - "$3"' _ "$tmp/key.txt" "$obj" "$STUB_LOG/plain.dump"
check "file target: object is not plaintext" bash -c '[[ "$(head -c 5 "$1")" != PGDMP ]]' _ "$obj"
check "file target: success heartbeat only" \
  bash -c '[[ "$(cat "$1")" == https://hb.example/api/v1/heartbeat/TOKEN ]]' _ "$STUB_LOG/heartbeats"
check "docker: pinned postgres:17 image, pg_dump -Fc --schema=public" \
  grep -qE 'postgres:17\.[0-9]+-bookworm@sha256:[0-9a-f]{64} pg_dump --format=custom --schema=public' "$STUB_LOG/docker.args"
check "docker: password passed by name only, TLS verify-full with the CA mounted" \
  bash -c 'grep -q -- "-e PGPASSWORD " "$1" && grep -q "/run/secrets/pg-ca.crt:ro" "$1" && ! grep -q Pw0rdNotInArgv "$1"' _ "$STUB_LOG/docker.args"
check "backup.log: one OK line" grep -q ' OK key=' "$STUB_LOG/backup.log"
# X5 #1: an attached `docker run` still sends the container's stdout to the
# daemon's log driver (json-file, /var/lib/docker/containers/<id>/*-json.log),
# so without --log-driver none the plaintext dump is written to disk.
check "docker: pg_dump runs with --log-driver none (the dump never reaches Docker's log files)" \
  bash -c 'grep -E -- "--log-driver none( |$)" "$1" | grep -q pg_dump' _ "$STUB_LOG/docker.args"

case_dir b2
backup_env BACKUP_TARGET=r2 bash "$scripts/backup.sh" 2>"$STUB_LOG/err"
rc=$?
obj="$(objects "$STUB_R2")"
check "r2 target: exits 0" test "$rc" -eq 0
check "r2 target: object in azira-db-backups/yyyy/mm/, partial renamed" \
  bash -c '[[ $(wc -l <<<"$1") == 1 && "$1" =~ /azira-db-backups/[0-9]{4}/[0-9]{2}/[0-9]{8}T[0-9]{6}Z\.dump\.age$ ]]' _ "$obj"
check "r2 target: rcat and copyto use --s3-no-check-bucket" \
  bash -c 'grep -q "^rcat --s3-no-check-bucket r2:azira-db-backups/.*\.partial$" "$1" && grep -q "^copyto --s3-no-check-bucket " "$1"' _ "$STUB_LOG/rclone.args"
check "r2 target: object decrypts to the exact dump" \
  bash -c 'age -d -i "$1" "$2" | cmp -s - "$3"' _ "$tmp/key.txt" "$obj" "$STUB_LOG/plain.dump"

# X5 #2: with the bucket lock rule r2.md recommends, R2 refuses every delete
# and overwrite (HTTP 409). S3 has no rename, so `rclone moveto` is a copy and
# then a delete of the .partial: the delete fails, and every run used to be
# reported FAILED (with a /fail ping) although the backup was stored.
case_dir b2l
backup_env BACKUP_TARGET=r2 STUB_R2_LOCKED=1 bash "$scripts/backup.sh" 2>"$STUB_LOG/err"
rc=$?
obj="$(objects "$STUB_R2" | grep -v '\.partial$')"
check "r2 with a bucket lock: exits 0" test "$rc" -eq 0
check "r2 with a bucket lock: one final object that decrypts to the exact dump" \
  bash -c '[[ $(wc -l <<<"$2") == 1 ]] && age -d -i "$1" "$2" | cmp -s - "$3"' _ "$tmp/key.txt" "$obj" "$STUB_LOG/plain.dump"
check "r2 with a bucket lock: success heartbeat only, backup.log says OK" \
  bash -c '[[ "$(cat "$1")" == https://hb.example/api/v1/heartbeat/TOKEN ]] && grep -q " OK key=" "$2"' _ "$STUB_LOG/heartbeats" "$STUB_LOG/backup.log"
check "r2 with a bucket lock: says the .partial copy stays until the lifecycle rule" \
  grep -q 'lifecycle' "$STUB_LOG/err"

case_dir b3
backup_env BACKUP_TARGET=r2 STUB_DUMP=fail bash "$scripts/backup.sh" 2>"$STUB_LOG/err"
rc=$?
check "pg_dump fails midway: exits non-zero" test "$rc" -ne 0
check "pg_dump fails midway: no object left (partial deleted)" test -z "$(objects "$STUB_R2")"
check "pg_dump fails midway: /fail heartbeat" \
  bash -c '[[ "$(cat "$1")" == https://hb.example/api/v1/heartbeat/TOKEN/fail ]]' _ "$STUB_LOG/heartbeats"
check "pg_dump fails midway: the error names pg_dump" grep -q 'pg_dump failed' "$STUB_LOG/err"

case_dir b4
backup_env BACKUP_TARGET="file://$STUB_LOG/out" STUB_DUMP=small bash "$scripts/backup.sh" 2>"$STUB_LOG/err"
rc=$?
check "too small: exits non-zero, nothing kept, /fail heartbeat" \
  bash -c '[[ $1 -ne 0 && -z "$2" && "$(cat "$3")" == */fail ]]' _ "$rc" "$(objects "$STUB_LOG/out")" "$STUB_LOG/heartbeats"
check "too small: the error gives the size" grep -q 'minimum 1000' "$STUB_LOG/err"

case_dir b5
backup_env BACKUP_TARGET=r2 BACKUP_AGE_RECIPIENT= bash "$scripts/backup.sh" 2>"$STUB_LOG/err"
rc=$?
check "no recipient: refused before docker runs, /fail heartbeat" \
  bash -c '[[ $1 -ne 0 && ! -e "$2/docker.args" && "$(cat "$2/heartbeats")" == */fail ]]' _ "$rc" "$STUB_LOG"

case_dir b6
backup_env BACKUP_TARGET=r2 BACKUP_AGE_RECIPIENT="$(grep AGE-SECRET-KEY "$tmp/key.txt")" bash "$scripts/backup.sh" 2>"$STUB_LOG/err"
rc=$?
check "a private key as recipient: refused" bash -c '[[ $1 -ne 0 && ! -e "$2/docker.args" ]]' _ "$rc" "$STUB_LOG"

case_dir b7
backup_env BACKUP_TARGET=r2 PGSSLMODE=require bash "$scripts/backup.sh" 2>"$STUB_LOG/err"
rc=$?
check "PGSSLMODE=require: refused (no server verification)" \
  bash -c '[[ $1 -ne 0 && ! -e "$2/docker.args" ]] && grep -q "use verify-full" "$2/err"' _ "$rc" "$STUB_LOG"

case_dir b7ca
backup_env BACKUP_TARGET=r2 PGSSLMODE=verify-ca bash "$scripts/backup.sh" 2>"$STUB_LOG/err"
rc=$?
check "PGSSLMODE=verify-ca: refused (no host name check; Supabase's CA signs every project)" \
  bash -c '[[ $1 -ne 0 && ! -e "$2/docker.args" ]] && grep -q "use verify-full" "$2/err"' _ "$rc" "$STUB_LOG"

case_dir b8
backup_env BACKUP_TARGET=s3://elsewhere bash "$scripts/backup.sh" 2>"$STUB_LOG/err"
check "unknown BACKUP_TARGET: refused" test $? -ne 0

# ---- restore.sh --------------------------------------------------------------

echo "# restore.sh"

# An encrypted fake archive, and a truncated copy of it.
{ printf 'PGDMP'; head -c 50000 /dev/urandom; } | age -r "$recipient" -o "$tmp/good.dump.age"
head -c 30000 "$tmp/good.dump.age" >"$tmp/truncated.dump.age"

url=postgresql://postgres@localhost:5432/medusa_i7_restore

restore_env() {
  env -i PATH="$PATH" HOME="${HOME:-/tmp}" TMPDIR="$tmp" PGPASSWORD=postgres \
    AGE_IDENTITY="$tmp/key.txt" STUB_LOG="$STUB_LOG" STUB_R2="$STUB_R2" "$@"
}

refused() { # description, then [VAR=value ...] bash restore.sh <args>; $GREP must be in stderr
  # A refusal never reaches the restore itself (pg_restore --single-transaction).
  local d="$1"; shift
  restore_env "$@" >"$STUB_LOG/out" 2>"$STUB_LOG/err"
  local rc=$?
  if [[ $rc -ne 0 ]] && ! grep -qs -- --single-transaction "$STUB_LOG/pg_restore.args"     && grep -q "$GREP" "$STUB_LOG/err"; then
    ok "$d"
  else
    not_ok "$d (rc=$rc: $(tail -n 1 "$STUB_LOG/err"))"
  fi
}

case_dir r1; GREP=refusing refused "target name without _restore: refused" \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" postgresql://postgres@localhost/medusa_m2
case_dir r2; GREP=refusing refused "remote host: refused" \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" postgresql://postgres@db.prod.supabase.co:5432/medusa_restore
case_dir r3; GREP="not allowed" refused "host= in the query string: refused" \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" "postgresql://postgres@localhost/medusa_restore?host=db.prod.supabase.co"
case_dir r4; GREP="name its host" refused "empty host (falls back to PGHOST): refused" \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" postgresql:///medusa_restore
case_dir r5; GREP=refusing refused "two hosts in the URL: refused" \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" postgresql://postgres@localhost,db.prod.supabase.co/medusa_restore
case_dir r6; GREP="does not match" refused "RESTORE_CONFIRM_TARGET for another target: refused" \
  RESTORE_CONFIRM_TARGET=db.prod.supabase.co/postgres \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" postgresql://postgres@db.new.supabase.co/postgres
case_dir r7; GREP="decryption failed" refused "wrong key: fails clearly before pg_restore" \
  AGE_IDENTITY="$tmp/other-key.txt" bash "$scripts/restore.sh" "$tmp/good.dump.age" "$url"
case_dir r8; GREP="decryption failed" refused "truncated object: fails clearly before pg_restore" \
  bash "$scripts/restore.sh" "$tmp/truncated.dump.age" "$url"
case_dir r9; GREP="not empty" refused "target not empty: refused" \
  STUB_TABLES=12 bash "$scripts/restore.sh" "$tmp/good.dump.age" "$url"
case_dir r10; GREP="several schemas" refused "dump names two extension schemas: refused" \
  STUB_EXT_SCHEMA=mixed bash "$scripts/restore.sh" "$tmp/good.dump.age" "$url"
case_dir r11; GREP="another schema" refused "extensions already elsewhere: refused" \
  STUB_PLACED="pg_trgm=public unaccent=public" bash "$scripts/restore.sh" "$tmp/good.dump.age" "$url"
case_dir r12; GREP="refusing" refused "scratch host not in RESTORE_ALLOWED_HOSTS: refused" \
  RESTORE_ALLOWED_HOSTS=db.scratch.supabase.co \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" postgresql://postgres@db.other.supabase.co/medusa_restore
case_dir r13; GREP="decryption failed" refused "scratch host in RESTORE_ALLOWED_HOSTS: passes the guard (then a wrong key stops it)"   RESTORE_ALLOWED_HOSTS="db.other.example db.scratch.supabase.co" AGE_IDENTITY="$tmp/other-key.txt"   bash "$scripts/restore.sh" "$tmp/good.dump.age" "postgresql://postgres@db.scratch.supabase.co:5432/medusa_restore?sslmode=verify-full"
case_dir r14; GREP="decryption failed" refused "RESTORE_CONFIRM_TARGET spelled exactly, verify-full: passes the guard (then a wrong key stops it)"   RESTORE_CONFIRM_TARGET=db.new.supabase.co/postgres AGE_IDENTITY="$tmp/other-key.txt" PGSSLMODE=verify-full PGSSLROOTCERT="$tmp/ca.crt"   bash "$scripts/restore.sh" "$tmp/good.dump.age" postgresql://postgres@db.new.supabase.co/postgres
# X5 #3: a restore sends the whole decrypted database to the target. To any
# host but this machine it must use verified TLS, as backup.sh does.
case_dir r15; GREP="verify-full" refused "remote target without PGSSLMODE (libpq default prefer): refused" \
  RESTORE_CONFIRM_TARGET=db.new.supabase.co/postgres \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" postgresql://postgres@db.new.supabase.co/postgres
case_dir r16; GREP="verify-full" refused "allowed scratch host with PGSSLMODE=require: refused" \
  RESTORE_ALLOWED_HOSTS=db.scratch.supabase.co PGSSLMODE=require \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" postgresql://postgres@db.scratch.supabase.co/medusa_restore
case_dir r17; GREP="verify-full" refused "?sslmode=require in the URL beats PGSSLMODE=verify-full: refused" \
  RESTORE_ALLOWED_HOSTS=db.scratch.supabase.co PGSSLMODE=verify-full \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" "postgresql://postgres@db.scratch.supabase.co/medusa_restore?sslmode=require"
case_dir r18; GREP="decryption failed" refused "compose host with RESTORE_ALLOW_INSECURE_TLS=1: passes the guard (then a wrong key stops it)" \
  RESTORE_ALLOWED_HOSTS=postgres RESTORE_ALLOW_INSECURE_TLS=1 AGE_IDENTITY="$tmp/other-key.txt" \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" postgresql://postgres@postgres:5432/medusa_restore

case_dir r20
restore_env bash "$scripts/restore.sh" "$tmp/good.dump.age" "$url" >"$STUB_LOG/out" 2>"$STUB_LOG/err"
rc=$?
check "Supabase-style dump: exits 0" test "$rc" -eq 0
check "extension SQL is review finding 14, verbatim" \
  grep -qxF 'CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;' "$STUB_LOG/psql.sql"
# shellcheck disable=SC2016 # "$user" is SQL
check "search_path gets the extensions schema" \
  grep -qxF 'ALTER DATABASE medusa_i7_restore SET search_path TO "$user", public, extensions;' "$STUB_LOG/psql.sql"
check "pg_restore: --no-owner --no-acl in one transaction, stops on error" \
  grep -q -- '--no-owner --no-acl --single-transaction --exit-on-error -L ' "$STUB_LOG/pg_restore.args"
check "restore list: drops CREATE SCHEMA public and its comment, keeps the rest" \
  bash -c '! grep -q "SCHEMA - public\|COMMENT - SCHEMA public" "$1" && grep -q "TABLE DATA public order" "$1" && grep -q "TEXT SEARCH CONFIGURATION public medusa_search_lk" "$1"' _ "$STUB_LOG/restore.list"
check "report: row counts and the latest order" \
  bash -c 'grep -qx "rows: product=3 order=2 customer=2 payment=4" "$1" && grep -qx "latest_order_created_at: 2026-10-29T05:58:12.345+00:00" "$1"' _ "$STUB_LOG/out"
check "ANALYZE runs after the restore" grep -qx 'ANALYZE;' "$STUB_LOG/psql.sql"
check "the decrypted dump is deleted afterwards" bash -c '! ls -d "$1"/restore.* 2>/dev/null | grep -q .' _ "$tmp"

case_dir r21
restore_env STUB_EXT_SCHEMA=public STUB_PLACED="pg_trgm=public unaccent=public" \
  bash "$scripts/restore.sh" "$tmp/good.dump.age" "$url" >"$STUB_LOG/out" 2>"$STUB_LOG/err"
rc=$?
check "local-style dump (public.unaccent): extensions created in public, no search_path change" \
  bash -c '[[ $1 -eq 0 ]] && grep -qxF "CREATE SCHEMA IF NOT EXISTS public; CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public; CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;" "$2/psql.sql" && ! grep -q "ALTER DATABASE" "$2/psql.sql"' _ "$rc" "$STUB_LOG"

case_dir r22
mkdir -p "$STUB_R2/azira-db-backups/2026/09" "$STUB_R2/azira-db-backups/2026/10"
cp "$tmp/truncated.dump.age" "$STUB_R2/azira-db-backups/2026/09/20260930T180000Z.dump.age"
cp "$tmp/good.dump.age" "$STUB_R2/azira-db-backups/2026/10/20261029T060000Z.dump.age"
cp "$tmp/truncated.dump.age" "$STUB_R2/azira-db-backups/2026/10/20261029T120000Z.dump.age.partial"
restore_env bash "$scripts/restore.sh" latest "$url" >"$STUB_LOG/out" 2>"$STUB_LOG/err"
rc=$?
check "latest: picks the newest finished object from R2" \
  bash -c '[[ $1 -eq 0 ]] && grep -qx "object: 20261029T060000Z.dump.age" "$2/out"' _ "$rc" "$STUB_LOG"

case_dir r23
restore_env STUB_RESTORE_STATUS=1 bash "$scripts/restore.sh" "$tmp/good.dump.age" "$url" >"$STUB_LOG/out" 2>"$STUB_LOG/err"
rc=$?
check "pg_restore error: exits non-zero, says nothing was committed" \
  bash -c '[[ $1 -ne 0 ]] && grep -q "nothing was committed" "$2/err"' _ "$rc" "$STUB_LOG"

echo
echo "passed $passed, failed $failed"
(( failed == 0 ))
