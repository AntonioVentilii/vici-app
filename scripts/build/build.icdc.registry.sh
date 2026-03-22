#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

"$BUILD_SCRIPTS_DIR/build.icdc.registry.wasm.sh"
"$BUILD_SCRIPTS_DIR/build.icdc.registry.args.sh"
