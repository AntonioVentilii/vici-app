#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

"$BUILD_SCRIPTS_DIR/download.icdc.index.sh"
"$BUILD_SCRIPTS_DIR/build.icdc.index.args.sh"
