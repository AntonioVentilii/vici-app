#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/utils.sh" "$@"

"$SCRIPT_DIR/download.cketh.sh" # Uses the same Wasms as cketh.
"$SCRIPT_DIR/build.ckusdc_index.args.sh"
