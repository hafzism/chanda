#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PROJECT_DIR=$(cd -- "$SCRIPT_DIR/../.." && pwd)
ENV_FILE=${1:-$SCRIPT_DIR/.env.production}
COMPOSE_FILE=$SCRIPT_DIR/compose.production.yaml
CLOUDWATCH_COMPOSE_FILE=$SCRIPT_DIR/compose.cloudwatch.yaml
DEPLOY_MODE=${DEPLOY_MODE:-pull}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Production environment file not found: $ENV_FILE" >&2
  exit 1
fi

permissions=$(stat -c '%a' "$ENV_FILE")
if [[ "$permissions" != '600' && "$permissions" != '400' ]]; then
  echo "Production environment file must have mode 0600 or 0400." >&2
  exit 1
fi

compose=(
  docker compose
  --env-file "$ENV_FILE"
  -f "$COMPOSE_FILE"
  -f "$CLOUDWATCH_COMPOSE_FILE"
)
"${compose[@]}" config --quiet

case "$DEPLOY_MODE" in
  build)
    "${compose[@]}" build
    ;;
  pull)
    image_ref=$(sed -n 's/^SUPPLINE_IMAGE=//p' "$ENV_FILE" | tail -n 1)
    if [[ -z "$image_ref" || "$image_ref" == 'suppline-ai:production' ]]; then
      echo "Set SUPPLINE_IMAGE to the published registry image before a pull deployment." >&2
      exit 1
    fi
    # SSM retains only a bounded amount of command output. Suppress per-layer
    # progress so a registry, network, or disk error remains visible.
    "${compose[@]}" pull --quiet
    ;;
  *)
    echo "DEPLOY_MODE must be 'pull' or 'build'." >&2
    exit 1
    ;;
esac

"${compose[@]}" --profile tools run --rm migrate
"${compose[@]}" up --detach --no-build --remove-orphans --wait --wait-timeout 180

app_domain=$(sed -n 's/^APP_DOMAIN=//p' "$ENV_FILE" | tail -n 1)
echo "Suppline AI is healthy at https://$app_domain"
