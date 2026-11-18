#!/usr/bin/env bash
# make-user-data.sh: prints the cloud-init user-data for the Azira droplet.
#
#   ADMIN_USER=azadmin \
#   ADMIN_SSH_PUBKEY="ssh-ed25519 AAAA... admin" \
#   DEPLOY_SSH_PUBKEY="ssh-ed25519 AAAA... azira-github-deploy" \
#     bash infra/vps/make-user-data.sh > user-data.sh
#
# Optional inputs (defaults are Azira's): BACKEND_IMAGE_REPO (default
# ghcr.io/thisuranr/azira-backend) and GHCR_OWNER (default thisuranr). They are
# the pin written to /opt/azira/image-pin.env: the only image the droplet will run.
#
# Each of the three may also be a path to a file holding the public key. The
# result is ONE self-contained shell script (cloud-init runs a user-data that
# starts with #!/bin/bash): the three inputs sit at its top, and below them the
# infra/ files the bootstrap needs (bootstrap.sh and its config files, deploy.sh,
# deploy-gate.sh, apply-env.sh, backup.sh, restore.sh, the compose file) travel
# as a base64 tarball. It unpacks them to /root/azira-infra and runs
# bootstrap.sh non-interactively. Everything is logged to
# /var/log/azira-bootstrap.log. DigitalOcean's user-data limit is 64 KiB; this
# script refuses to print anything larger.
#
# No secret is in it: public keys only. Tests, docs and the Cloudflare notes are
# left out to keep it small.
set -euo pipefail
export LC_ALL=C

readonly LIMIT=65536
readonly KEY_RE='^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com) [A-Za-z0-9+/=]+( [A-Za-z0-9@._ -]*)?$'

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"

die() {
  printf 'make-user-data: %s\n' "$*" >&2
  exit 1
}

# key_text <value-or-file>: the key line(s), one per line, each checked.
key_text() {
  local input=$1 line out="" n=0
  [[ -n $input ]] || return 1
  if [[ -f $input ]]; then input=$(cat "$input"); fi
  while IFS= read -r line || [[ -n $line ]]; do
    line=${line%$'\r'}
    case $line in '' | '#'*) continue ;; esac
    [[ $line =~ $KEY_RE ]] || die "not a plain public key line: ${line:0:40}"
    out+="$line"$'\n'
    n=$((n + 1))
  done <<<"$input"
  ((n >= 1)) || return 1
  printf '%s' "$out"
}

ADMIN_USER=${ADMIN_USER:-}
[[ $ADMIN_USER =~ ^[a-z][a-z0-9_-]{1,30}$ ]] || die "set ADMIN_USER to a lower-case login name, for example azadmin"
case $ADMIN_USER in root | deploy | admin) die "ADMIN_USER must not be root, deploy or admin" ;; esac
admin_keys=$(key_text "${ADMIN_SSH_PUBKEY:-}") || die "set ADMIN_SSH_PUBKEY (the admin's public key, text or file)"
deploy_keys=$(key_text "${DEPLOY_SSH_PUBKEY:-}") || die "set DEPLOY_SSH_PUBKEY (the CI deploy key's public half, text or file)"
[[ $(printf '%s\n' "$deploy_keys" | wc -l) -eq 1 ]] || die "DEPLOY_SSH_PUBKEY must hold exactly one key"

BACKEND_IMAGE_REPO=${BACKEND_IMAGE_REPO:-ghcr.io/thisuranr/azira-backend}
GHCR_OWNER=${GHCR_OWNER:-thisuranr}
[[ $BACKEND_IMAGE_REPO =~ ^ghcr\.io/[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._/-]*$ ]] || die "BACKEND_IMAGE_REPO must be a lowercase ghcr.io/<owner>/<name> reference without a tag"
[[ $GHCR_OWNER =~ ^[a-z0-9][a-z0-9-]{0,38}$ ]] || die "GHCR_OWNER must be a lowercase GitHub user name"

for f in vps/bootstrap.sh deploy/deploy.sh deploy/deploy-gate.sh deploy/apply-env.sh backup/backup.sh backup/restore.sh compose/docker-compose.prod.yml; do
  [[ -f $REPO_ROOT/infra/$f ]] || die "missing infra/$f"
done

tarball=$(cd "$REPO_ROOT" && tar --sort=name --mtime='2026-01-01 00:00:00' --owner=0 --group=0 --numeric-owner \
  -cz \
  infra/vps/bootstrap.sh infra/vps/files \
  infra/deploy/deploy.sh infra/deploy/deploy-gate.sh infra/deploy/apply-env.sh \
  infra/backup/backup.sh infra/backup/restore.sh \
  infra/compose/docker-compose.prod.yml | base64 -w0 | fold -w 76)

# The keys are inserted inside single quotes: the key regex allows no quote.
# Several admin keys are joined with newlines inside one quoted string.
out=$(
  cat <<HEAD
#!/bin/bash
# Azira droplet bootstrap: cloud-init user-data (made by infra/vps/make-user-data.sh).
# Inputs. Public keys only; nothing secret is in this file.
ADMIN_USER='${ADMIN_USER}'
ADMIN_SSH_PUBKEY='${admin_keys%$'\n'}'
DEPLOY_SSH_PUBKEY='${deploy_keys%$'\n'}'
# The only image the droplet will run, and the only registry login it accepts.
BACKEND_IMAGE_REPO='${BACKEND_IMAGE_REPO}'
GHCR_OWNER='${GHCR_OWNER}'
# ---------------------------------------------------------------------------
set -euo pipefail
exec > >(tee -a /var/log/azira-bootstrap.log) 2>&1
echo "azira bootstrap: start \$(date -u +%FT%TZ)"
export ADMIN_USER ADMIN_SSH_PUBKEY DEPLOY_SSH_PUBKEY BACKEND_IMAGE_REPO GHCR_OWNER
export DEBIAN_FRONTEND=noninteractive
mkdir -p /root/azira-infra
base64 -d <<'AZIRA_INFRA_PAYLOAD' | tar -xz -C /root/azira-infra
${tarball}
AZIRA_INFRA_PAYLOAD
bash /root/azira-infra/infra/vps/bootstrap.sh
echo "azira bootstrap: done \$(date -u +%FT%TZ)"
HEAD
)

size=$(printf '%s\n' "$out" | wc -c)
((size <= LIMIT)) || die "the user-data is $size bytes; DigitalOcean's limit is $LIMIT"
printf '%s\n' "$out"
printf 'make-user-data: %s bytes (limit %s)\n' "$size" "$LIMIT" >&2
