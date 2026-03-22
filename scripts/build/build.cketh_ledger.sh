#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

"$BUILD_SCRIPTS_DIR/download.cketh.sh"
"$BUILD_SCRIPTS_DIR/build.cketh_ledger.args.sh"
