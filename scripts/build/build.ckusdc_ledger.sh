#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

"$BUILD_SCRIPTS_DIR/download.cketh.sh" # Uses the same Wasm as cketh.
"$BUILD_SCRIPTS_DIR/build.ckusdc_ledger.args.sh"
