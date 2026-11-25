#!/bin/sh
set -eu
exec 9>/run/lock/ibis-merchant-recovery.lock
flock -n 9 || exit 0
# Use the application's filesystem and PID namespace to check the actual worker.
docker cp /opt/ibis-electronics/maintenance/recoverMerchantJobs.cjs \
  ibis-electronics:/tmp/ibis-recover-merchant-jobs.cjs
exec docker exec -e NODE_PATH=/app/node_modules ibis-electronics \
  node /tmp/ibis-recover-merchant-jobs.cjs "$@"
