#!/bin/zsh
# Publish the garden on this Mac. Meant to be run over SSH from another machine:
#   ssh <mac> ~/Projects/Yuri/Website/scripts/publish-remote.sh [--wait SECONDS] [--sync-only]
#
# --wait N     sleep N seconds first so Syncthing can deliver just-saved notes
# --sync-only  copy notes into content/notes but don't build or deploy (for testing)
set -euo pipefail

wait_s=0
target=publish-garden
while (( $# )); do
  case $1 in
    --wait) wait_s=$2; shift 2 ;;
    --sync-only) target=sync-notes; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

# Non-interactive SSH shells don't load nvm, so load it here.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  source "$NVM_DIR/nvm.sh" >/dev/null
fi
export PATH="/opt/homebrew/bin:$PATH"
command -v npm >/dev/null || { echo "npm not found on the Mac" >&2; exit 1; }

cd "${0:A:h}/.."

if (( wait_s > 0 )); then
  echo "Waiting ${wait_s}s for Syncthing..."
  sleep "$wait_s"
fi

exec npm run "$target"
