#!/usr/bin/env bash
# =====================================================================
# VPS bootstrap for Azira (azira.com.au)
#
# One-time, idempotent setup of the production droplet (Ubuntu 24.04 LTS, 2 GB,
# DigitalOcean Sydney SYD1). Two ways to run it:
#
#  1. As cloud-init user-data (the normal way). `infra/vps/make-user-data.sh`
#     prints a self-contained shell script (the infra/ folder is packed inside
#     it, about 30 KB; DigitalOcean's limit is 64 KiB) with the three inputs at
#     its top: ADMIN_USER, ADMIN_SSH_PUBKEY, DEPLOY_SSH_PUBKEY. Send it as the
#     droplet's user-data. The log is /var/log/azira-bootstrap.log.
#  2. By hand, as root, from a copy of the infra/ folder:
#       ADMIN_USER=<login> ADMIN_SSH_PUBKEY=<key text or file> \
#       DEPLOY_SSH_PUBKEY=<key text or file> bash infra/vps/bootstrap.sh
#
# Either way it never asks a question, and running it again changes nothing
# that is already right. Later, as the admin user:
#   sudo bash infra/vps/bootstrap.sh install-files | fix-perms | check
#
#   all            (default) every step below
#   install-files  copy the deploy, backup and compose files from this copy of infra/ into /opt/azira
#   fix-perms      set the owners and modes under /opt/azira
#   check          read-only report of the hardening
#
# What `all` does, in this order (SSH hardening is last, so an earlier failure
# never leaves you locked out):
#   1. base packages (fail2ban, unattended-upgrades, age, rclone, gnupg ...)
#   2. server clock set to Australia/Sydney (the 04:00 reboot uses it)
#   3. 2 GB swapfile, swappiness 10
#   4. Docker CE from Docker's apt repository (key fingerprint checked) and
#      /etc/docker/daemon.json (log caps 10m x 5, IPv6, ip6tables)
#   5. the admin sudo user and the `deploy` user (forced command, no shell access)
#   6. /opt/azira layout and file permissions
#   7. the deploy, backup and compose files into /opt/azira
#   8. sudoers (deploy.sh and apply-env.sh only, checked with visudo -c)
#   9. sshd hardening (key only, no root, AllowUsers), then fail2ban
#  10. unattended-upgrades (security only, reboot at 04:00 Sydney time)
#  11. systemd units for the backup job (installed, NOT enabled)
#
# Environment:
#   ADMIN_USER          required: the admin login name, for example "azadmin"
#   ADMIN_SSH_PUBKEY    the admin's public key(s): key text or a file path.
#                       Default /root/.ssh/authorized_keys (the key DigitalOcean installed)
#   DEPLOY_SSH_PUBKEY   required: the CI deploy key's PUBLIC key, text or file path
#                       (the private half goes to the GitHub secret DEPLOY_SSH_KEY)
#   BACKEND_IMAGE_REPO  the ONLY image repository deploys may run, default
#                       ghcr.io/thisuranr/azira-backend (lowercase, no tag). Written to
#                       /opt/azira/image-pin.env (root:root 0644); apply-env.sh and
#                       deploy.sh refuse any other image, so the deploy key cannot run
#                       somebody else's image.
#   GHCR_OWNER          the only GHCR login user apply-env.sh accepts, default
#                       thisuranr (the GitHub owner's name is Thisuranr; compared lowercase)
#   TIMEZONE            default Australia/Sydney
#   SWAP_SIZE           default 2G
#   BOOTSTRAP_DRY_RUN=1 print every action, change nothing (works without root)
#
# Needs: bash, coreutils, and on the droplet apt, systemd, sudo, openssh-server.
# =====================================================================
set -euo pipefail

# Docker's apt signing key (docs.docker.com lists key ID 0EBFCD88). The script
# stops if the downloaded key does not have exactly this fingerprint.
readonly DOCKER_GPG_FPR="9DC858229FC7DD38854AE2D88D81803C0EBFCD88"
readonly SHOP_DIR="/opt/azira"
readonly KEY_RE='^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com) [A-Za-z0-9+/=]+( [^[:cntrl:]]*)?$'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILES_DIR="${SCRIPT_DIR}/files"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DRY_RUN="${BOOTSTRAP_DRY_RUN:-0}"
ADMIN_USER="${ADMIN_USER:-}"
ADMIN_SSH_PUBKEY_GIVEN="${ADMIN_SSH_PUBKEY:-}"
ADMIN_SSH_PUBKEY="${ADMIN_SSH_PUBKEY:-/root/.ssh/authorized_keys}"
DEPLOY_SSH_PUBKEY="${DEPLOY_SSH_PUBKEY:-}"
BACKEND_IMAGE_REPO="${BACKEND_IMAGE_REPO:-ghcr.io/thisuranr/azira-backend}"
GHCR_OWNER="${GHCR_OWNER:-thisuranr}"
TIMEZONE="${TIMEZONE:-Australia/Sydney}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
# cloud-init runs this while the first-boot apt jobs may still hold the lock.
APT_OPTS=(-o DPkg::Lock::Timeout=300)

CHANGED=0
TMP=""
TMP_FILES=()
ADMIN_KEYS=""
DEPLOY_KEYS=""

log() { printf '[bootstrap] %s\n' "$*"; }
warn() { printf '[bootstrap] WARNING: %s\n' "$*" >&2; }
die() {
  printf '[bootstrap] ERROR: %s\n' "$*" >&2
  exit 1
}
step() { printf '\n== %s ==\n' "$*"; }
dry() { [ "${DRY_RUN}" = "1" ]; }

cleanup() {
  local f
  for f in "${TMP_FILES[@]+"${TMP_FILES[@]}"}"; do rm -f "${f}"; done
}
trap cleanup EXIT

# run CMD ARGS...: execute, or only print in dry-run mode.
run() {
  if dry; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

# mktmp: create a temp file (removed on exit) and leave its path in $TMP.
# Never call it inside $(...): a subshell would lose the cleanup list.
mktmp() {
  TMP="$(mktemp)"
  TMP_FILES+=("${TMP}")
}

# render SRC: replace @ADMIN_USER@; the rendered temp file's path is left in $TMP.
render() {
  mktmp
  sed -e "s|@ADMIN_USER@|${ADMIN_USER}|g" "$1" >"${TMP}"
}

need_root() {
  if ! dry && [ "$(id -u)" -ne 0 ]; then die "run as root (sudo)"; fi
}

# install_file SRC DEST MODE OWNER:GROUP
# Copies only when the content differs; always re-applies mode and owner.
# Sets CHANGED=1 when the content changed (or in dry-run), else 0.
install_file() {
  local src="$1" dest="$2" mode="$3" owner="$4"
  if dry; then
    log "[dry-run] install ${src#"${REPO_ROOT}/"} -> ${dest} (mode ${mode}, ${owner})"
    case "${src}" in
      "${REPO_ROOT}"/*) ;;
      *) sed -e 's/^/            | /' "${src}" ;; # generated content: show it
    esac
    CHANGED=1
    return 0
  fi
  if [ -f "${dest}" ] && cmp -s "${src}" "${dest}"; then
    chmod "${mode}" "${dest}"
    chown "${owner}" "${dest}"
    CHANGED=0
    return 0
  fi
  install -D -m "${mode}" -o "${owner%%:*}" -g "${owner##*:}" "${src}" "${dest}"
  log "wrote ${dest}"
  CHANGED=1
}

# read_keys TEXT_OR_FILE [lenient]: print the plain public-key lines, one per line.
# Lines with options (command=, from=, ...) are refused, because this script writes
# its own options. In lenient mode (used for root's own authorized_keys, where a
# DigitalOcean console session may leave a temporary entry) such lines are skipped
# with a warning instead of stopping the script.
read_keys() {
  local input="$1" lenient="${2:-}" line count=0
  if [ -f "${input}" ]; then input="$(cat "${input}")"; fi
  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%$'\r'}"
    case "${line}" in '' | '#'*) continue ;; esac
    if ! [[ "${line}" =~ ${KEY_RE} ]]; then
      if [ -n "${lenient}" ]; then
        warn "skipping a line that is not a plain public key: ${line:0:30}..."
        continue
      fi
      die "not a plain public key line (options are not allowed): ${line:0:40}..."
    fi
    printf '%s\n' "${line}"
    count=$((count + 1))
  done <<<"${input}"
  [ "${count}" -ge 1 ] || die "no public key found in: ${1:0:60}"
}

# ------------------------------------------------------------------ preflight

preflight() {
  step "Preflight"
  need_root
  if [ -r /etc/os-release ]; then
    # ID and VERSION_ID come from os-release (hence SC2154); the file is not followed (SC1091)
    # shellcheck disable=SC1091,SC2154
    . /etc/os-release
    if [ "${ID:-}" != "ubuntu" ]; then
      if dry; then warn "not Ubuntu (${ID:-unknown}); fine for a dry run"; else die "this script is written for Ubuntu 24.04 LTS (found ${ID:-unknown})"; fi
    elif [ "${VERSION_ID:-}" != "24.04" ]; then
      warn "tested on Ubuntu 24.04, found ${VERSION_ID:-unknown}; read each step before trusting it"
    fi
  elif ! dry; then
    die "/etc/os-release not found"
  fi
  [[ "${ADMIN_USER}" =~ ^[a-z][a-z0-9_-]{1,30}$ ]] || die "set ADMIN_USER to a lower-case login name, for example ADMIN_USER=azadmin"
  case "${ADMIN_USER}" in root | deploy | admin) die "ADMIN_USER must not be root, deploy or admin" ;; esac
  [ -n "${DEPLOY_SSH_PUBKEY}" ] || die "set DEPLOY_SSH_PUBKEY (the CI deploy key's public half, text or file)"
  if [ -n "${ADMIN_SSH_PUBKEY_GIVEN:-}" ]; then
    ADMIN_KEYS="$(read_keys "${ADMIN_SSH_PUBKEY}")"
  else
    ADMIN_KEYS="$(read_keys "${ADMIN_SSH_PUBKEY}" lenient)"
  fi
  DEPLOY_KEYS="$(read_keys "${DEPLOY_SSH_PUBKEY}")"
  [ "$(printf '%s\n' "${DEPLOY_KEYS}" | wc -l)" -eq 1 ] || die "DEPLOY_SSH_PUBKEY must hold exactly one key"
  [ -d "${FILES_DIR}" ] || die "missing ${FILES_DIR}: copy the whole infra/ folder, not just this script"
  log "admin user: ${ADMIN_USER}; admin keys: $(printf '%s\n' "${ADMIN_KEYS}" | wc -l); deploy key: 1; dry-run: ${DRY_RUN}"
}

# ------------------------------------------------------------------- packages

step_packages() {
  step "Base packages"
  export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
  run apt-get "${APT_OPTS[@]}" update
  # python3-systemd is what lets fail2ban read the journal (Ubuntu 24.04 has no auth.log);
  # age and rclone are for the backup job (task I7); no --no-install-recommends, because
  # fail2ban's firewall helpers arrive as recommended packages.
  run apt-get "${APT_OPTS[@]}" install -y ca-certificates curl gnupg fail2ban python3-systemd unattended-upgrades age rclone
}

step_timezone() {
  step "Server clock: ${TIMEZONE}"
  run timedatectl set-timezone "${TIMEZONE}"
}

# ----------------------------------------------------------------------- swap

step_swap() {
  step "Swap (${SWAP_SIZE}, swappiness 10)"
  if dry; then
    log "[dry-run] create /swapfile ${SWAP_SIZE}, mkswap, swapon, add to /etc/fstab"
  else
    if ! swapon --show=NAME --noheadings | grep -q '^/swapfile'; then
      if [ ! -f /swapfile ]; then
        fallocate -l "${SWAP_SIZE}" /swapfile
      fi
      chmod 0600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      log "swap on"
    else
      log "swap already on"
    fi
    if ! grep -qE '^/swapfile[[:space:]]' /etc/fstab; then
      printf '/swapfile none swap sw 0 0\n' >>/etc/fstab
      log "added /swapfile to /etc/fstab"
    fi
  fi
  install_file "${FILES_DIR}/99-azira-sysctl.conf" /etc/sysctl.d/99-azira.conf 0644 root:root
  run sysctl -p /etc/sysctl.d/99-azira.conf
}

# --------------------------------------------------------------------- docker

step_docker() {
  step "Docker CE and daemon.json"
  local was_running=0 daemon_changed=0
  if ! dry && command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet docker; then was_running=1; fi

  # daemon.json first, so a fresh install starts with the log caps and IPv6 on.
  install_file "${FILES_DIR}/docker-daemon.json" /etc/docker/daemon.json 0644 root:root
  daemon_changed="${CHANGED}"

  if dry; then
    log "[dry-run] download https://download.docker.com/linux/ubuntu/gpg, require fingerprint ${DOCKER_GPG_FPR}"
    log "[dry-run] write /etc/apt/keyrings/docker.asc and /etc/apt/sources.list.d/docker.sources, apt-get install docker-ce ..."
    return 0
  fi

  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    local key fpr codename arch
    mktmp
    key="${TMP}"
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o "${key}"
    fpr="$(gpg --show-keys --with-colons "${key}" | awk -F: '$1 == "fpr" { print $10; exit }')"
    [ "${fpr}" = "${DOCKER_GPG_FPR}" ] || die "Docker apt key fingerprint is ${fpr:-empty}, expected ${DOCKER_GPG_FPR}; stopping (compare with docs.docker.com before changing the constant)"
    install -d -m 0755 /etc/apt/keyrings
    install -m 0644 "${key}" /etc/apt/keyrings/docker.asc
    # VERSION_CODENAME comes from os-release (SC2154); the file is not followed (SC1091)
    # shellcheck disable=SC1091,SC2154
    codename="$(. /etc/os-release && printf '%s' "${UBUNTU_CODENAME:-${VERSION_CODENAME}}")"
    arch="$(dpkg --print-architecture)"
    cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${codename}
Components: stable
Architectures: ${arch}
Signed-By: /etc/apt/keyrings/docker.asc
EOF
    apt-get "${APT_OPTS[@]}" update
    apt-get "${APT_OPTS[@]}" install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    log "docker and the compose plugin are already installed"
  fi

  systemctl enable docker >/dev/null
  if [ "${was_running}" = "1" ] && [ "${daemon_changed}" = "1" ]; then
    warn "daemon.json changed: restarting Docker (running containers restart too)"
    systemctl restart docker
  else
    systemctl start docker
  fi
}

# ---------------------------------------------------------------------- users

# write_text DEST MODE OWNER:GROUP <<<"content"  (a here-string, never a pipe: a
# pipe would run this in a subshell and lose CHANGED and the cleanup list)
write_text() {
  mktmp
  cat >"${TMP}"
  install_file "${TMP}" "$1" "$2" "$3"
}

step_users() {
  step "Users and SSH keys"
  # Admin login: key-only, passwordless sudo (documented in docs/hosting.md).
  if id "${ADMIN_USER}" >/dev/null 2>&1; then
    log "user ${ADMIN_USER} exists"
  else
    run useradd --create-home --shell /bin/bash --groups sudo "${ADMIN_USER}"
  fi
  run install -d -m 0700 -o "${ADMIN_USER}" -g "${ADMIN_USER}" "/home/${ADMIN_USER}/.ssh"
  write_text "/home/${ADMIN_USER}/.ssh/authorized_keys" 0600 "${ADMIN_USER}:${ADMIN_USER}" <<<"${ADMIN_KEYS}"

  # deploy: no password, no sudo or docker group, a root-owned home so it cannot
  # change its own authorized_keys, rc files or the forced command.
  if id deploy >/dev/null 2>&1; then
    log "user deploy exists"
  else
    run useradd --no-create-home --home-dir /home/deploy --shell /bin/bash deploy
  fi
  run passwd -l deploy
  run install -d -m 0755 -o root -g root /home/deploy /home/deploy/.ssh
  local deploy_line
  deploy_line="command=\"${SHOP_DIR}/bin/deploy-gate.sh\",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc ${DEPLOY_KEYS}"
  write_text /home/deploy/.ssh/authorized_keys 0644 root:root <<<"${deploy_line}"
}

# --------------------------------------------------------------- /opt/azira

# Owners and modes under /opt/azira. Safe to run any number of times; files that
# do not exist yet are skipped (add the secrets, then run `fix-perms` again).
fix_permissions() {
  step "/opt/azira layout and permissions"
  run install -d -m 0755 -o root -g root "${SHOP_DIR}" "${SHOP_DIR}/bin" "${SHOP_DIR}/compose" "${SHOP_DIR}/certs"
  if dry; then
    log "[dry-run] chmod 0600 .env redis.env tunnel.env backup.env (root); certs/*.crt 0644; bin/* 0755 root"
    return 0
  fi
  local f
  for f in "${SHOP_DIR}/.env" "${SHOP_DIR}/redis.env" "${SHOP_DIR}/tunnel.env" "${SHOP_DIR}/backup.env"; do
    if [ -f "${f}" ]; then chown root:root "${f}"; chmod 0600 "${f}"; fi
  done
  for f in "${SHOP_DIR}"/certs/*; do
    [ -f "${f}" ] || continue
    chown root:root "${f}"
    chmod 0644 "${f}"
  done
  for f in "${SHOP_DIR}"/bin/*; do
    [ -f "${f}" ] || continue
    chown root:root "${f}"
    chmod 0755 "${f}"
  done
  log "permissions applied"
}

# install_if_present SRC DEST MODE: copy a file another task produces; warn if absent.
install_if_present() {
  if [ -f "$1" ]; then
    install_file "$1" "$2" "$3" root:root
  else
    warn "not found, skipped: ${1#"${REPO_ROOT}/"} (is the whole infra/ folder here?)"
  fi
}

step_install_files() {
  step "Install deploy, backup and compose files into ${SHOP_DIR}"
  run install -d -m 0755 -o root -g root "${SHOP_DIR}" "${SHOP_DIR}/bin" "${SHOP_DIR}/compose"
  install_if_present "${REPO_ROOT}/infra/deploy/deploy.sh" "${SHOP_DIR}/bin/deploy.sh" 0755
  install_if_present "${REPO_ROOT}/infra/deploy/deploy-gate.sh" "${SHOP_DIR}/bin/deploy-gate.sh" 0755
  install_if_present "${REPO_ROOT}/infra/deploy/apply-env.sh" "${SHOP_DIR}/bin/apply-env.sh" 0755
  install_if_present "${REPO_ROOT}/infra/backup/backup.sh" "${SHOP_DIR}/bin/backup.sh" 0755
  install_if_present "${REPO_ROOT}/infra/backup/restore.sh" "${SHOP_DIR}/bin/restore.sh" 0755
  # The pin: the one image repository and GHCR user the server will accept.
  # Root-owned, so the deploy user (and its key) cannot change it.
  [[ ${BACKEND_IMAGE_REPO} =~ ^ghcr\.io/[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._/-]*$ ]] ||
    die "BACKEND_IMAGE_REPO must be a lowercase ghcr.io/<owner>/<name> reference without a tag"
  [[ ${GHCR_OWNER} =~ ^[a-z0-9][a-z0-9-]{0,38}$ ]] || die "GHCR_OWNER must be a lowercase GitHub user name"
  write_text "${SHOP_DIR}/image-pin.env" 0644 root:root <<<"BACKEND_IMAGE_REPO=${BACKEND_IMAGE_REPO}
GHCR_OWNER=${GHCR_OWNER}"
  # deploy.sh reads the stack from ${SHOP_DIR}/compose. Its non-secret .env
  # (BACKEND_IMAGE) is written by apply-env.sh on every deploy.
  install_if_present "${REPO_ROOT}/infra/compose/docker-compose.prod.yml" "${SHOP_DIR}/compose/docker-compose.prod.yml" 0644
}

# --------------------------------------------------------------------- sudoers

step_sudoers() {
  step "sudoers"
  mktmp
  cp "${FILES_DIR}/sudoers-deploy" "${TMP}"
  if command -v visudo >/dev/null 2>&1; then visudo -cf "${TMP}" >/dev/null || die "sudoers-deploy failed visudo -c"; fi
  install_file "${TMP}" /etc/sudoers.d/deploy 0440 root:root

  render "${FILES_DIR}/sudoers-admin.tmpl"
  if command -v visudo >/dev/null 2>&1; then visudo -cf "${TMP}" >/dev/null || die "sudoers-admin failed visudo -c"; fi
  install_file "${TMP}" /etc/sudoers.d/90-azira-admin 0440 root:root
  if ! dry; then visudo -c >/dev/null || die "visudo -c failed after installing the sudoers files"; fi
}

# ------------------------------------------------------------------------ ssh

step_ssh() {
  step "sshd hardening"
  local dropin=/etc/ssh/sshd_config.d/00-azira-hardening.conf
  if ! dry; then
    [ -s "/home/${ADMIN_USER}/.ssh/authorized_keys" ] || die "refusing to harden sshd: ${ADMIN_USER} has no authorized_keys"
    grep -qE '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d/\*\.conf' /etc/ssh/sshd_config ||
      die "/etc/ssh/sshd_config does not include sshd_config.d/*.conf; add the settings by hand"
  fi
  render "${FILES_DIR}/sshd-hardening.conf.tmpl"
  install_file "${TMP}" "${dropin}" 0644 root:root
  if dry; then
    log "[dry-run] sshd -t; systemctl reload ssh"
    return 0
  fi
  # Ubuntu 24.04 starts sshd through ssh.socket (AWS Lightsail images do), so
  # the privilege separation directory may not exist yet and `sshd -t` fails
  # without it. Creating it is what ssh.service itself does at start.
  install -d -m 0755 -o root -g root /run/sshd
  if ! sshd -t; then
    rm -f "${dropin}"
    die "sshd -t rejected the new settings; the drop-in was removed and sshd was not reloaded"
  fi
  if [ "${CHANGED}" = "1" ]; then
    if systemctl is-active --quiet ssh; then
      systemctl reload ssh
    elif systemctl is-active --quiet sshd; then
      systemctl reload sshd
    else
      # Socket-activated: each new connection starts sshd with the new config.
      log "ssh.service is not running (socket activation); new logins use the new settings"
    fi
    log "sshd settings applied. KEEP THIS SESSION OPEN and test a second login as ${ADMIN_USER} before you close it."
  fi
}

step_fail2ban() {
  step "fail2ban"
  install_file "${FILES_DIR}/fail2ban-azira.local" /etc/fail2ban/jail.d/azira.local 0644 root:root
  run systemctl enable fail2ban
  if [ "${CHANGED}" = "1" ]; then run systemctl restart fail2ban; else run systemctl start fail2ban; fi
}

step_unattended() {
  step "unattended-upgrades (security only, reboot 04:00)"
  install_file "${FILES_DIR}/20auto-upgrades" /etc/apt/apt.conf.d/20auto-upgrades 0644 root:root
  install_file "${FILES_DIR}/52azira-unattended-upgrades" /etc/apt/apt.conf.d/52azira-unattended-upgrades 0644 root:root
  run systemctl enable --now unattended-upgrades
}

step_systemd_units() {
  step "systemd units for the backup job (installed, not enabled)"
  install_file "${FILES_DIR}/systemd/azira-backup.service" /etc/systemd/system/azira-backup.service 0644 root:root
  install_file "${FILES_DIR}/systemd/azira-backup.timer" /etc/systemd/system/azira-backup.timer 0644 root:root
  run systemctl daemon-reload
  log "the backup timer stays off until you enable it (docs/hosting.md, Backups): systemctl enable --now azira-backup.timer"
}

step_agent() {
  step "DigitalOcean monitoring agent"
  if dry; then
    log "[dry-run] check systemctl is-active do-agent"
  elif systemctl is-active --quiet do-agent; then
    log "do-agent is running"
  else
    warn "do-agent is not running: DigitalOcean alerts will not work. Tick 'Monitoring' when creating the droplet (docs/hosting.md)"
  fi
}

# ---------------------------------------------------------------------- check

PASS=0
FAIL=0
ok() {
  PASS=$((PASS + 1))
  printf '  ok    %s\n' "$*"
}
bad() {
  FAIL=$((FAIL + 1))
  printf '  FAIL  %s\n' "$*"
}
# expect_eq LABEL WANT GOT
expect_eq() { if [ "$2" = "$3" ]; then ok "$1 = $3"; else bad "$1: wanted '$2', got '$3'"; fi; }

do_check() {
  step "Hardening report (read-only)"
  [ "$(id -u)" -eq 0 ] || die "run check as root (sudo): it reads sshd, fail2ban and Docker state"
  local sshd_t pair v f spec want cid listeners sudo_l allowed
  sshd_t="$(sshd -T 2>/dev/null || true)"
  for pair in "permitrootlogin no" "passwordauthentication no" "kbdinteractiveauthentication no" "pubkeyauthentication yes"; do
    v="$(printf '%s\n' "${sshd_t}" | awk -v k="${pair%% *}" '$1 == k { print $2 }')"
    expect_eq "sshd ${pair%% *}" "${pair##* }" "${v}"
  done
  if printf '%s\n' "${sshd_t}" | grep -q '^allowusers .*deploy'; then ok "sshd AllowUsers includes deploy"; else bad "sshd AllowUsers does not include deploy"; fi
  if systemctl is-active --quiet fail2ban && fail2ban-client status sshd >/dev/null 2>&1; then ok "fail2ban sshd jail active"; else bad "fail2ban sshd jail not active"; fi
  if apt-config dump | grep -q 'Unattended-Upgrade::Automatic-Reboot-Time "04:00"'; then ok "unattended-upgrades reboot at 04:00"; else bad "unattended-upgrades reboot time not set"; fi
  allowed="$(apt-config dump | grep 'Unattended-Upgrade::Allowed-Origins' || true)"
  if [ -n "${allowed}" ] && ! printf '%s\n' "${allowed}" | grep -q 'updates'; then ok "unattended-upgrades origins: security only"; else bad "unattended-upgrades origins missing or include -updates"; fi
  if swapon --show=NAME --noheadings | grep -q '^/swapfile'; then ok "swapfile active"; else bad "swapfile not active"; fi
  expect_eq "vm.swappiness" "10" "$(sysctl -n vm.swappiness)"
  expect_eq "timezone" "${TIMEZONE}" "$(timedatectl show -p Timezone --value)"
  if command -v docker >/dev/null 2>&1; then
    expect_eq "docker logging driver" "json-file" "$(docker info --format '{{.LoggingDriver}}')"
    # `docker info` does not list log options; read them back from a created container.
    docker image inspect hello-world >/dev/null 2>&1 || docker pull -q hello-world >/dev/null
    cid="$(docker create hello-world)"
    expect_eq "docker log options" "map[max-file:5 max-size:10m]" "$(docker inspect -f '{{.HostConfig.LogConfig.Config}}' "${cid}")"
    docker rm "${cid}" >/dev/null
    expect_eq "docker default bridge IPv6" "true" "$(docker network inspect bridge -f '{{.EnableIPv6}}')"
  else
    bad "docker is not installed"
  fi
  # Nothing may listen on a non-loopback address except sshd on 22 (no published ports).
  listeners="$(ss -H -ltn | awk '{ print $4 }' | grep -vE '^(127\.|\[::1\])' | grep -vE ':22$' || true)"
  if [ -z "${listeners}" ]; then ok "only sshd listens beyond loopback"; else bad "unexpected listeners: ${listeners//$'\n'/ }"; fi
  # The deploy user.
  if id -nG deploy 2>/dev/null | tr ' ' '\n' | grep -qxE 'sudo|docker|adm'; then bad "deploy is in a privileged group"; else ok "deploy is in no privileged group"; fi
  if grep -q "^command=\"${SHOP_DIR}/bin/deploy-gate.sh\",no-port-forwarding" /home/deploy/.ssh/authorized_keys 2>/dev/null; then ok "deploy key has the forced command"; else bad "deploy key lacks the forced command"; fi
  expect_eq "/home/deploy/.ssh/authorized_keys owner" "0:0" "$(stat -c '%u:%g' /home/deploy/.ssh/authorized_keys 2>/dev/null || echo missing)"
  sudo_l="$(sudo -l -U deploy 2>/dev/null || true)"
  if printf '%s\n' "${sudo_l}" | grep -q "(root) NOPASSWD: ${SHOP_DIR}/bin/deploy.sh, ${SHOP_DIR}/bin/apply-env.sh\$" && ! printf '%s\n' "${sudo_l}" | grep -qE '\) (NOPASSWD: )?ALL$'; then ok "deploy may sudo deploy.sh and apply-env.sh only"; else bad "deploy's sudo rights are not exactly deploy.sh and apply-env.sh"; fi
  # /opt/azira owners and modes ("mode uid:gid"). Files that do not exist yet are skipped.
  expect_eq "${SHOP_DIR}" "755 0:0" "$(stat -c '%a %u:%g' "${SHOP_DIR}" 2>/dev/null || echo missing)"
  expect_eq "${SHOP_DIR}/bin" "755 0:0" "$(stat -c '%a %u:%g' "${SHOP_DIR}/bin" 2>/dev/null || echo missing)"
  for spec in ".env|600 0:0" "redis.env|600 0:0" "tunnel.env|600 0:0" "backup.env|600 0:0" "certs/supabase-ca.crt|644 0:0" "image-pin.env|644 0:0"; do
    f="${spec%%|*}"
    want="${spec##*|}"
    if [ -e "${SHOP_DIR}/${f}" ]; then
      expect_eq "${SHOP_DIR}/${f}" "${want}" "$(stat -c '%a %u:%g' "${SHOP_DIR}/${f}")"
    else
      printf '  skip  %s (not created yet)\n' "${SHOP_DIR}/${f}"
    fi
  done
  if systemctl is-active --quiet do-agent; then ok "do-agent running"; else bad "do-agent not running"; fi
  printf '\n%s passed, %s failed\n' "${PASS}" "${FAIL}"
  [ "${FAIL}" -eq 0 ]
}

# -------------------------------------------------------------------- summary

summary() {
  cat <<EOF

== Done ==
The droplet is ready for its first deploy. Nothing else is installed by hand:
the GitHub "Backend deploy" workflow sends the settings and the image.
  1. Test the new login from your PC:  ssh ${ADMIN_USER}@<droplet IPv4>
  2. Report (needs the infra/ folder on the droplet):  sudo bash infra/vps/bootstrap.sh check
  3. Run the GitHub workflow "Backend deploy" (docs/hosting.md, first deploy order).
EOF
}

# ----------------------------------------------------------------------- main

main() {
  local cmd="${1:-all}"
  case "${cmd}" in
    all)
      preflight
      step_packages
      step_timezone
      step_swap
      step_docker
      step_users
      fix_permissions
      step_install_files
      step_sudoers
      step_ssh
      step_fail2ban
      step_unattended
      step_systemd_units
      step_agent
      summary
      ;;
    install-files)
      need_root
      step_install_files
      fix_permissions
      ;;
    fix-perms)
      need_root
      fix_permissions
      ;;
    check) do_check ;;
    *) die "unknown command '${cmd}' (use: all | install-files | fix-perms | check)" ;;
  esac
}

# Run only when executed, so tests can `source` this file and call the helpers.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  main "$@"
fi
