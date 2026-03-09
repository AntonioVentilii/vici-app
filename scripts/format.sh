#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$(realpath "$0")")/.."

set -x
time xargs -P8 -I{} bash -c "{}" <<EOF
./scripts/format.sh.sh
EOF
