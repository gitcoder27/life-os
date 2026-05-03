#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${RCLONE_REMOTE:?RCLONE_REMOTE must point at an encrypted off-server rclone remote}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/life-os/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_PATH="${BACKUP_DIR}/life-os-postgres-${TIMESTAMP}.dump"

umask 077
mkdir -p "${BACKUP_DIR}"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="${DUMP_PATH}" \
  "${DATABASE_URL}"

sha256sum "${DUMP_PATH}" > "${DUMP_PATH}.sha256"

rclone copy "${DUMP_PATH}" "${RCLONE_REMOTE}"
rclone copy "${DUMP_PATH}.sha256" "${RCLONE_REMOTE}"

find "${BACKUP_DIR}" -type f -name "life-os-postgres-*.dump" -mtime +"${BACKUP_RETENTION_DAYS}" -delete
find "${BACKUP_DIR}" -type f -name "life-os-postgres-*.dump.sha256" -mtime +"${BACKUP_RETENTION_DAYS}" -delete

echo "[life-os-backup] created and uploaded ${DUMP_PATH}"
