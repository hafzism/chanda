#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ENV_FILE=${ENV_FILE:-$SCRIPT_DIR/.env.production}
BACKUP_BUCKET=${BACKUP_BUCKET:?Set BACKUP_BUCKET to a private S3 bucket.}
AWS_REGION=${AWS_REGION:?Set AWS_REGION to the backup bucket region.}
COMPOSE_FILE=$SCRIPT_DIR/compose.production.yaml
timestamp=$(date -u +'%Y-%m-%dT%H-%M-%SZ')
object_uri="s3://$BACKUP_BUCKET/postgres/suppline-$timestamp.dump"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Production environment file not found: $ENV_FILE" >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  sh -lc 'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner --no-privileges' |
  aws s3 cp - "$object_uri" \
    --only-show-errors \
    --region "$AWS_REGION" \
    --server-side-encryption AES256

echo "Created encrypted PostgreSQL backup: $object_uri"
