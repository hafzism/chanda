#!/usr/bin/env bash

set -euo pipefail

BACKUP_URI=${1:?Usage: verify-backup.sh s3://bucket/postgres/file.dump}
AWS_REGION=${AWS_REGION:?Set AWS_REGION to the backup bucket region.}

aws s3 cp "$BACKUP_URI" - --only-show-errors --region "$AWS_REGION" |
  docker run --rm --interactive \
    pgvector/pgvector:0.8.1-pg17@sha256:3e8b3adfd27b5707128f60956f62a793c3c9326ea8cfaf0eab7adccb5d700b21 \
    pg_restore --list >/dev/null

echo "Backup archive is readable: $BACKUP_URI"
