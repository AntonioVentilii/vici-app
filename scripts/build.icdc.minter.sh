#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/utils.sh" "$@"

"$SCRIPT_DIR/download.icdc.minter.sh"
"$SCRIPT_DIR/build.icdc.minter.args.sh"
