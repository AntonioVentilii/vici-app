#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/utils.sh" "$@"

"$SCRIPT_DIR/download.cketh.sh"
"$SCRIPT_DIR/build.cketh_minter.args.sh"
