#!/usr/bin/env bash
# deploy-gate.sh: the forced command of the `deploy` SSH user. 
#
# Installed as /opt/azira/bin/deploy-gate.sh (root:root, 0755; /opt/azira and
# /opt/azira/bin are root 0755, so `deploy` can run it but not change it).
# ~deploy/.ssh/authorized_keys holds one line for the GitHub Actions key:
#   restrict,command="/opt/azira/bin/deploy-gate.sh" ssh-ed25519 AAAA... gha-deploy
# (`restrict` turns off port, agent and X11 forwarding, the pty and ~/.ssh/rc;
# on OpenSSH older than 7.2 spell them out: no-port-forwarding,
# no-agent-forwarding,no-X11-forwarding,no-pty.)
# /etc/sudoers.d/deploy lets `deploy` run deploy.sh only:
#   deploy ALL=(root) NOPASSWD: /opt/azira/bin/deploy.sh
#
# Whatever the client asked for arrives in SSH_ORIGINAL_COMMAND. Only three
# requests are accepted, and nothing from the request is passed on except the sha:
#   deploy <40-hex sha>          -> sudo deploy.sh <sha>
#   deploy <40-hex sha> --now    -> sudo deploy.sh <sha> --now
#   env                          -> sudo apply-env.sh, with the settings on stdin
# (apply-env.sh checks them against an allow-list; see its header.) The sha and
# flag are passed to sudo as separate words, never through a shell.

set -euo pipefail
export LC_ALL=C

# --- settings: infra/deploy/tests/run.sh rewrites only the lines in this block
SUDO=/usr/bin/sudo
DEPLOY_SH=/opt/azira/bin/deploy.sh
APPLY_ENV_SH=/opt/azira/bin/apply-env.sh
PATH=/usr/sbin:/usr/bin:/sbin:/bin
# --- end of settings
export PATH
readonly SUDO DEPLOY_SH APPLY_ENV_SH

readonly ALLOWED='^deploy ([0-9a-f]{40})( --now)?$'
readonly ENV_REQUEST='env'

request=${SSH_ORIGINAL_COMMAND-}

# The settings: stdin goes straight through sudo to apply-env.sh.
if [[ $request == "$ENV_REQUEST" ]]; then
  exec "$SUDO" -n "$APPLY_ENV_SH"
fi

if [[ ! $request =~ $ALLOWED ]]; then
  # The request itself is not echoed or logged: it is attacker-controlled.
  echo "deploy-gate: refused; the only commands are: deploy <40-hex sha> [--now], and env" >&2
  if command -v logger >/dev/null 2>&1; then
    logger -t deploy-gate "refused a request (${#request} bytes)" || true
  fi
  exit 1
fi

sha=${BASH_REMATCH[1]}
if [[ -n ${BASH_REMATCH[2]} ]]; then
  exec "$SUDO" -n "$DEPLOY_SH" "$sha" --now
fi
exec "$SUDO" -n "$DEPLOY_SH" "$sha"
