#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ENV_FILE=${ENV_FILE:-$SCRIPT_DIR/.env.production}
BACKUP_BUCKET=${BACKUP_BUCKET:?Set BACKUP_BUCKET to a private S3 bucket.}
AWS_REGION=${AWS_REGION:?Set AWS_REGION to the backup bucket region.}
BACKUP_METRICS_ENABLED=${BACKUP_METRICS_ENABLED:-false}
COMPOSE_FILE=$SCRIPT_DIR/compose.production.yaml
timestamp=$(date -u +'%Y-%m-%dT%H-%M-%SZ')
object_uri="s3://$BACKUP_BUCKET/postgres/chanda-$timestamp.dump"

publish_metric() {
  local value=$1
  if [[ "$BACKUP_METRICS_ENABLED" == 'true' ]]; then
    aws cloudwatch put-metric-data \
      --namespace Chanda/Backups \
      --metric-data "MetricName=SuccessfulBackup,Value=$value,Unit=Count" \
      --region "$AWS_REGION" >/dev/null
  fi
}

report_failure() {
  publish_metric 0 || true
}

trap report_failure ERR

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

trap - ERR
publish_metric 1
echo "Created encrypted PostgreSQL backup: $object_uri"
