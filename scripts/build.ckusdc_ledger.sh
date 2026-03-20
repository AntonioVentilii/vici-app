#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/utils.sh" "$@"

"$SCRIPT_DIR/download.cketh.sh" # Uses the same Wasm as cketh.
"$SCRIPT_DIR/build.ckusdc_ledger.args.sh"
