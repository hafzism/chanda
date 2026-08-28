#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PROJECT_DIR=$(cd -- "$SCRIPT_DIR/../.." && pwd)
ENV_FILE=${ENV_FILE:-$SCRIPT_DIR/.env.production}
IMAGE=${1:?Usage: deploy-release.sh ghcr.io/owner/repository:sha-COMMIT}
LOCK_FILE=/tmp/chanda-production-deploy.lock

if [[ ! "$IMAGE" =~ ^ghcr\.io/[a-z0-9_.-]+/[a-z0-9_.-]+:sha-[0-9a-f]{40}$ ]]; then
  echo 'Release image must be an immutable lowercase GHCR sha tag.' >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Production environment file not found: $ENV_FILE" >&2
  exit 1
fi

exec 9>"$LOCK_FILE"
if ! flock --nonblock 9; then
  echo 'Another Chanda deployment is already running.' >&2
  exit 1
fi

cd "$PROJECT_DIR"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo 'Tracked files on the production host are modified; refusing deployment.' >&2
  exit 1
fi

git fetch --quiet origin main
git merge --ff-only origin/main

if grep -q '^CHANDA_IMAGE=' "$ENV_FILE"; then
  sed -i "s|^CHANDA_IMAGE=.*|CHANDA_IMAGE=$IMAGE|" "$ENV_FILE"
else
  printf '\nCHANDA_IMAGE=%s\n' "$IMAGE" >>"$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

DEPLOY_MODE=pull "$SCRIPT_DIR/deploy.sh" "$ENV_FILE"
