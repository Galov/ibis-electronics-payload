#!/bin/sh
set -eu
exec 9>/run/lock/ibis-history-retention.lock
flock -n 9 || exit 0
mode="${1:-jobs}"
case "$mode" in jobs|versions) ;; *) exit 2 ;; esac
image=$(docker inspect --format '{{.Image}}' ibis-electronics)
exec docker run --rm --user 0:0 \
  --env-file /opt/ibis-electronics/app/.env.production \
  -e NODE_PATH=/app/node_modules \
  -e MAINTENANCE_ARCHIVE_DIR=/archives \
  --mount type=bind,src=/opt/ibis-electronics/maintenance,dst=/maintenance,readonly \
  --mount type=bind,src=/opt/ibis-electronics/backups/history-retention,dst=/archives \
  --entrypoint node "$image" /maintenance/retainDatabaseHistory.cjs "$@"
