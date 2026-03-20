#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/utils.sh" "$@"

"$SCRIPT_DIR/build.icdc.registry.wasm.sh"
"$SCRIPT_DIR/build.icdc.registry.args.sh"
