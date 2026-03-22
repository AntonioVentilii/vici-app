#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

"$BUILD_SCRIPTS_DIR/download.icdc.minter.sh"
"$BUILD_SCRIPTS_DIR/build.icdc.minter.args.sh"
