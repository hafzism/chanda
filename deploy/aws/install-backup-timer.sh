#!/usr/bin/env bash

set -euo pipefail

BACKUP_BUCKET=${1:?Usage: sudo install-backup-timer.sh BACKUP_BUCKET AWS_REGION}
AWS_REGION=${2:?Usage: sudo install-backup-timer.sh BACKUP_BUCKET AWS_REGION}
PROJECT_DIR=/opt/suppline-ai
SERVICE_FILE=/etc/systemd/system/suppline-backup.service
TIMER_FILE=/etc/systemd/system/suppline-backup.timer

if [[ $EUID -ne 0 ]]; then
  echo 'Run this installer with sudo.' >&2
  exit 1
fi

if [[ ! "$BACKUP_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]]; then
  echo 'Backup bucket name is invalid.' >&2
  exit 1
fi

if [[ ! "$AWS_REGION" =~ ^[a-z]{2}(-gov)?-[a-z]+-[0-9]$ ]]; then
  echo 'AWS region is invalid.' >&2
  exit 1
fi

if [[ ! -x "$PROJECT_DIR/deploy/aws/backup-postgres.sh" ]]; then
  echo "Backup script is missing or not executable under $PROJECT_DIR." >&2
  exit 1
fi

cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Chanda AI encrypted PostgreSQL backup
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
User=suppline
Group=suppline
SupplementaryGroups=docker
WorkingDirectory=$PROJECT_DIR
Environment=AWS_REGION=$AWS_REGION
Environment=BACKUP_BUCKET=$BACKUP_BUCKET
Environment=BACKUP_METRICS_ENABLED=true
Environment=ENV_FILE=$PROJECT_DIR/deploy/aws/.env.production
ExecStart=/usr/bin/flock --nonblock /tmp/suppline-backup.lock $PROJECT_DIR/deploy/aws/backup-postgres.sh
EOF

cat >"$TIMER_FILE" <<'EOF'
[Unit]
Description=Run the Chanda AI PostgreSQL backup every day

[Timer]
OnCalendar=*-*-* 02:15:00 UTC
Persistent=true
RandomizedDelaySec=15m
Unit=suppline-backup.service

[Install]
WantedBy=timers.target
EOF

chmod 0644 "$SERVICE_FILE" "$TIMER_FILE"
systemctl daemon-reload
systemctl enable --now suppline-backup.timer
systemctl list-timers suppline-backup.timer --no-pager
