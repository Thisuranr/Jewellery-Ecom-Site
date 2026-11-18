#!/usr/bin/env bash
# Offline tests for infra/vps/bootstrap.sh and its config files (Azira).
# They need no root, no Docker and no network, and touch nothing outside a temp dir.
#
#   bash infra/vps/tests/test-bootstrap.sh
#
# What they cannot prove: real sshd, sudo, apt and Docker behaviour. That is the
# job of `bootstrap.sh check` on the droplet (docs/hosting.md).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VPS_DIR="$(cd "${HERE}/.." && pwd)"
BOOTSTRAP="${VPS_DIR}/bootstrap.sh"
FILES="${VPS_DIR}/files"

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# Names carry a t_ prefix because bootstrap.sh (sourced below) defines ok, bad, PASS and FAIL.
T_PASS=0
T_FAIL=0
t_ok() {
  T_PASS=$((T_PASS + 1))
  printf '  ok    %s\n' "$*"
}
t_bad() {
  T_FAIL=$((T_FAIL + 1))
  printf '  FAIL  %s\n' "$*"
}
check() { # check DESCRIPTION COMMAND...
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then t_ok "${desc}"; else t_bad "${desc}"; fi
}
refuse() { # refuse DESCRIPTION COMMAND...  (the command must fail)
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then t_bad "${desc} (was accepted)"; else t_ok "${desc}"; fi
}

# A throwaway public key. The blob is syntactically valid base64 but belongs to no private key.
KEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl test@example'

# --------------------------------------------------------------- syntax checks
echo "Syntax"
check "bootstrap.sh passes bash -n" bash -n "${BOOTSTRAP}"
check "this test passes bash -n" bash -n "${BASH_SOURCE[0]}"
check "docker-daemon.json is valid JSON" node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "${FILES}/docker-daemon.json"
check "daemon.json caps logs at 10m x 5" node -e '
  const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (j["log-opts"]["max-size"] !== "10m" || j["log-opts"]["max-file"] !== "5" || j.ipv6 !== true || j.ip6tables !== true) process.exit(1);
  if (!/^fd[0-9a-f]{2}:/.test(j["fixed-cidr-v6"])) process.exit(1);' "${FILES}/docker-daemon.json"

# ----------------------------------------------------------- line endings
# A script with CRLF line endings fails on Linux ("bash\r: No such file"). On a Windows
# checkout with core.autocrlf=true only infra/vps/.gitattributes prevents that.
echo "Line endings"
for f in "${VPS_DIR}/bootstrap.sh" "${HERE}/test-bootstrap.sh" "${FILES}"/* "${FILES}"/systemd/*; do
  [ -f "${f}" ] || continue
  check "no CR characters in ${f#"${VPS_DIR}/"}" test "$(tr -cd '\r' <"${f}" | wc -c)" -eq 0
done
check "infra/vps/.gitattributes forces LF" grep -q 'eol=lf' "${VPS_DIR}/.gitattributes"

# ------------------------------------------------------- config file contents
echo "Config files"
check "sshd drop-in: no root login" grep -qx 'PermitRootLogin no' "${FILES}/sshd-hardening.conf.tmpl"
check "sshd drop-in: no passwords" grep -qx 'PasswordAuthentication no' "${FILES}/sshd-hardening.conf.tmpl"
check "sshd drop-in: AllowUsers lists the admin placeholder and deploy" grep -qx 'AllowUsers @ADMIN_USER@ deploy' "${FILES}/sshd-hardening.conf.tmpl"
check "unattended-upgrades: no -updates pocket" bash -c "! grep -v '^//' '${FILES}/52azira-unattended-upgrades' | grep -q 'updates\"'"
check "unattended-upgrades: security origin present" grep -q '\${distro_codename}-security' "${FILES}/52azira-unattended-upgrades"
check "unattended-upgrades: reboot at 04:00" grep -q 'Automatic-Reboot-Time "04:00"' "${FILES}/52azira-unattended-upgrades"
check "unattended-upgrades: braces balanced" bash -c "[ \$(tr -cd '{' < '${FILES}/52azira-unattended-upgrades' | wc -c) -eq \$(tr -cd '}' < '${FILES}/52azira-unattended-upgrades' | wc -c) ]"
check "fail2ban: sshd jail enabled, journal backend" bash -c "grep -q '^enabled = true' '${FILES}/fail2ban-azira.local' && grep -q '^backend = systemd' '${FILES}/fail2ban-azira.local'"
check "sudoers-deploy: exactly one rule, deploy.sh and apply-env.sh only" bash -c "[ \$(grep -vE '^(#|\$)' '${FILES}/sudoers-deploy' | wc -l) -eq 1 ] && grep -qx 'deploy ALL=(root) NOPASSWD: /opt/azira/bin/deploy.sh, /opt/azira/bin/apply-env.sh' '${FILES}/sudoers-deploy'"
check "sudoers-deploy: no ALL command" bash -c "! grep -vE '^#' '${FILES}/sudoers-deploy' | grep -qE ': *ALL *\$'"
check "swappiness 10" grep -qx 'vm.swappiness = 10' "${FILES}/99-azira-sysctl.conf"
check "backup timer: every 6 hours, random delay, not auto-enabled by units" bash -c "grep -q 'OnCalendar=\\*-\\*-\\* 00/6:00:00' '${FILES}/systemd/azira-backup.timer' && grep -q 'RandomizedDelaySec=10min' '${FILES}/systemd/azira-backup.timer'"
check "backup service runs /opt/azira/bin/backup.sh as a oneshot" bash -c "grep -q '^ExecStart=/opt/azira/bin/backup.sh' '${FILES}/systemd/azira-backup.service' && grep -q '^Type=oneshot' '${FILES}/systemd/azira-backup.service'"
check "bootstrap never enables the backup timer" bash -c "! grep -v '^ *#' '${BOOTSTRAP}' | grep -v 'log ' | grep -q 'enable.*azira-backup'"
check "docker key fingerprint constant is 40 hex characters" bash -c "grep -qE '^readonly DOCKER_GPG_FPR=\"[0-9A-F]{40}\"' '${BOOTSTRAP}'"

# --------------------------------------------------------------- functions
echo "Functions"
# shellcheck disable=SC1090
source "${BOOTSTRAP}"
set +e # the sourced script turned errexit on; the tests handle failures themselves

check "read_keys accepts a key given as text" bash -c "source '${BOOTSTRAP}'; read_keys '${KEY}' | grep -q ssh-ed25519"
printf '%s\n' "# a comment" "${KEY}" "" >"${WORK}/good.pub"
check "read_keys accepts a key file with comments" bash -c "source '${BOOTSTRAP}'; [ \"\$(read_keys '${WORK}/good.pub' | wc -l)\" -eq 1 ]"
refuse "read_keys refuses a key with options (command=...)" bash -c "source '${BOOTSTRAP}'; read_keys 'command=\"/bin/sh\" ${KEY}'"
refuse "read_keys refuses a no-pty prefix" bash -c "source '${BOOTSTRAP}'; read_keys 'no-pty ${KEY}'"
refuse "read_keys refuses garbage" bash -c "source '${BOOTSTRAP}'; read_keys 'not a key'"
refuse "read_keys refuses an empty file" bash -c ": >'${WORK}/empty.pub'; source '${BOOTSTRAP}'; read_keys '${WORK}/empty.pub'"
refuse "read_keys refuses a private key header" bash -c "source '${BOOTSTRAP}'; read_keys '-----BEGIN OPENSSH PRIVATE KEY-----'"
printf '%s\n' "command=\"/bin/true\" ${KEY}" "${KEY}" >"${WORK}/mixed.pub"
refuse "read_keys (strict) refuses a file that has an options line" bash -c "source '${BOOTSTRAP}'; read_keys '${WORK}/mixed.pub'"
check "read_keys (lenient) keeps the plain key and skips the options line" bash -c "source '${BOOTSTRAP}'; [ \"\$(read_keys '${WORK}/mixed.pub' lenient 2>/dev/null | wc -l)\" -eq 1 ]"
printf '%s\n' "command=\"/bin/true\" ${KEY}" >"${WORK}/onlyopt.pub"
refuse "read_keys (lenient) still refuses when no plain key is left" bash -c "source '${BOOTSTRAP}'; read_keys '${WORK}/onlyopt.pub' lenient"

# render: the admin placeholder is replaced everywhere.
ADMIN_USER=owner
render "${FILES}/sshd-hardening.conf.tmpl"
check "render fills AllowUsers" grep -qx 'AllowUsers owner deploy' "${TMP}"
check "render leaves no placeholder behind" bash -c "! grep -q '@ADMIN_USER@' '${TMP}'"
render "${FILES}/sudoers-admin.tmpl"
check "sudoers-admin renders to a rule for the owner" grep -qx 'owner ALL=(ALL) NOPASSWD:ALL' "${TMP}"

# install_file: writes, is idempotent, notices a change. The tests are not root, so
# `install` and `chown` are replaced by doubles that ignore the owner and group.
install() {
  local args=()
  while [ $# -gt 0 ]; do
    case "$1" in
      -o | -g) shift 2 ;;
      *) args+=("$1") && shift ;;
    esac
  done
  command install "${args[@]}"
}
chown() { :; }
ME="root:root"
DRY_RUN=0
printf 'one\n' >"${WORK}/src"
install_file "${WORK}/src" "${WORK}/out/dest" 0640 "${ME}" >/dev/null
check "install_file creates the file and parent directory" test -f "${WORK}/out/dest"
check "install_file reports a change on first write" test "${CHANGED}" = 1
install_file "${WORK}/src" "${WORK}/out/dest" 0640 "${ME}" >/dev/null
check "install_file reports no change on the second run" test "${CHANGED}" = 0
printf 'two\n' >"${WORK}/src"
install_file "${WORK}/src" "${WORK}/out/dest" 0640 "${ME}" >/dev/null
check "install_file reports a change when the content differs" test "${CHANGED}" = 1
check "install_file copies the new content" grep -qx two "${WORK}/out/dest"
case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) printf '  skip  file modes are not meaningful on this platform (%s)\n' "$(uname -s)" ;;
  *) check "install_file applies the mode" test "$(stat -c '%a' "${WORK}/out/dest")" = 640 ;;
esac

# A dry run changes nothing and says what it would do.
DRY_RUN=1
out="$(install_file "${WORK}/src" "${WORK}/dry/dest" 0644 "${ME}")"
check "dry-run install_file writes nothing" test ! -e "${WORK}/dry/dest"
check "dry-run install_file prints the plan" test -n "${out}"
DRY_RUN=0

# ---------------------------------------------------------- whole-script dry run
echo "Dry run of the whole script"
printf '%s\n' "${KEY}" >"${WORK}/owner.pub"
printf '%s\n' "${KEY/test@example/deploy@ci}" >"${WORK}/deploy.pub"
dry_all() { BOOTSTRAP_DRY_RUN=1 ADMIN_USER=owner ADMIN_SSH_PUBKEY="${WORK}/owner.pub" DEPLOY_SSH_PUBKEY="${WORK}/deploy.pub" bash "${BOOTSTRAP}" "$@"; }
dry_all >"${WORK}/dry.out" 2>&1
check "dry run exits 0" dry_all
check "dry run writes the forced-command key line" grep -q 'command="/opt/azira/bin/deploy-gate.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty' "${WORK}/dry.out"
check "dry run shows the sshd hardening" grep -q 'PermitRootLogin no' "${WORK}/dry.out"
check "dry run shows the AllowUsers line for the owner" grep -q 'AllowUsers owner deploy' "${WORK}/dry.out"
check "dry run names the Docker key fingerprint it will require" grep -q '9DC858229FC7DD38854AE2D88D81803C0EBFCD88' "${WORK}/dry.out"
check "dry run installs the backup timer" grep -q 'azira-backup.timer' "${WORK}/dry.out"
check "dry run does not enable the backup timer" bash -c "! grep -E '^\[dry-run\] systemctl enable.*azira-backup' '${WORK}/dry.out'"
check "dry run sets 0600 on the secret env files" bash -c "grep -q 'chmod 0600 .env redis.env tunnel.env backup.env' '${WORK}/dry.out'"
check "dry run installs apply-env.sh" bash -c "grep -q 'apply-env.sh' '${WORK}/dry.out'"
refuse "refuses to run without ADMIN_USER" bash -c "BOOTSTRAP_DRY_RUN=1 DEPLOY_SSH_PUBKEY='${WORK}/deploy.pub' bash '${BOOTSTRAP}'"
refuse "refuses ADMIN_USER=root" bash -c "BOOTSTRAP_DRY_RUN=1 ADMIN_USER=root ADMIN_SSH_PUBKEY='${WORK}/owner.pub' DEPLOY_SSH_PUBKEY='${WORK}/deploy.pub' bash '${BOOTSTRAP}'"
refuse "refuses ADMIN_USER=deploy" bash -c "BOOTSTRAP_DRY_RUN=1 ADMIN_USER=deploy ADMIN_SSH_PUBKEY='${WORK}/owner.pub' DEPLOY_SSH_PUBKEY='${WORK}/deploy.pub' bash '${BOOTSTRAP}'"
refuse "refuses a missing deploy key" bash -c "BOOTSTRAP_DRY_RUN=1 ADMIN_USER=owner ADMIN_SSH_PUBKEY='${WORK}/owner.pub' bash '${BOOTSTRAP}'"
printf '%s\n%s\n' "${KEY}" "${KEY/test@example/second@ci}" >"${WORK}/two.pub"
refuse "refuses two deploy keys" bash -c "BOOTSTRAP_DRY_RUN=1 ADMIN_USER=owner ADMIN_SSH_PUBKEY='${WORK}/owner.pub' DEPLOY_SSH_PUBKEY='${WORK}/two.pub' bash '${BOOTSTRAP}'"
refuse "refuses an unknown subcommand" bash -c "BOOTSTRAP_DRY_RUN=1 bash '${BOOTSTRAP}' frobnicate"

# ------------------------------------------------------- cloud-init user-data
echo "make-user-data.sh (cloud-init)"
MAKE="${VPS_DIR}/make-user-data.sh"
check "make-user-data.sh passes bash -n" bash -n "${MAKE}"
ADMIN_USER=azadmin ADMIN_SSH_PUBKEY="${WORK}/owner.pub" DEPLOY_SSH_PUBKEY="${WORK}/deploy.pub" bash "${MAKE}" >"${WORK}/user-data.sh" 2>/dev/null
check "user-data passes bash -n" bash -n "${WORK}/user-data.sh"
check "user-data is under DigitalOcean's 64 KiB limit" test "$(wc -c <"${WORK}/user-data.sh")" -lt 65536
check "user-data starts with a shebang for cloud-init" bash -c "head -1 '${WORK}/user-data.sh' | grep -qx '#!/bin/bash'"
check "user-data has the three inputs at its top" bash -c "head -8 '${WORK}/user-data.sh' | grep -q \"^ADMIN_USER='azadmin'\" && head -8 '${WORK}/user-data.sh' | grep -q '^ADMIN_SSH_PUBKEY=' && head -8 '${WORK}/user-data.sh' | grep -q '^DEPLOY_SSH_PUBKEY='"
mkdir -p "${WORK}/unpacked"
sed -n '/^base64 -d/,/^AZIRA_INFRA_PAYLOAD$/p' "${WORK}/user-data.sh" | sed '1d;$d' | base64 -d | tar -xz -C "${WORK}/unpacked"
check "the packed tree holds every file bootstrap installs" bash -c "cd '${WORK}/unpacked/infra' && test -f vps/bootstrap.sh && test -f deploy/apply-env.sh && test -f deploy/deploy-gate.sh && test -f deploy/deploy.sh && test -f backup/backup.sh && test -f compose/docker-compose.prod.yml && test -f vps/files/sudoers-deploy"
check "dry run of the unpacked copy installs every file" bash -c "BOOTSTRAP_DRY_RUN=1 ADMIN_USER=azadmin ADMIN_SSH_PUBKEY='${WORK}/owner.pub' DEPLOY_SSH_PUBKEY='${WORK}/deploy.pub' bash '${WORK}/unpacked/infra/vps/bootstrap.sh' | grep -c 'not found, skipped' | grep -qx 0"
refuse "make-user-data refuses ADMIN_USER=root" bash -c "ADMIN_USER=root ADMIN_SSH_PUBKEY='${WORK}/owner.pub' DEPLOY_SSH_PUBKEY='${WORK}/deploy.pub' bash '${MAKE}'"
refuse "make-user-data refuses a key with a quote in it" bash -c "ADMIN_USER=azadmin ADMIN_SSH_PUBKEY=\"${KEY}'; rm -rf /\" DEPLOY_SSH_PUBKEY='${WORK}/deploy.pub' bash '${MAKE}'"
refuse "make-user-data refuses two deploy keys" bash -c "ADMIN_USER=azadmin ADMIN_SSH_PUBKEY='${WORK}/owner.pub' DEPLOY_SSH_PUBKEY='${WORK}/two.pub' bash '${MAKE}'"
refuse "make-user-data refuses a missing deploy key" bash -c "ADMIN_USER=azadmin ADMIN_SSH_PUBKEY='${WORK}/owner.pub' bash '${MAKE}'"

printf '\n%s passed, %s failed\n' "${T_PASS}" "${T_FAIL}"
[ "${T_FAIL}" -eq 0 ]
