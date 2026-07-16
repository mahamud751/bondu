#!/bin/sh
set -eu

# The crypt remote encrypts both dump contents and object names before upload.
# Passwords and object-store credentials are supplied only by the deployment.
export RCLONE_CONFIG_SECURE_TYPE=crypt
export RCLONE_CONFIG_SECURE_REMOTE="offsite:${BACKUP_S3_BUCKET}/socialconnect"
export RCLONE_CONFIG_SECURE_PASSWORD="$(rclone obscure "${BACKUP_CRYPT_PASSWORD}")"
export RCLONE_CONFIG_SECURE_PASSWORD2="$(rclone obscure "${BACKUP_CRYPT_SALT}")"

while true; do
  rclone sync /backups secure: --checksum --fast-list --transfers 4
  rclone check /backups secure: --one-way --size-only
  sleep "${BACKUP_SYNC_INTERVAL_SECONDS}"
done
