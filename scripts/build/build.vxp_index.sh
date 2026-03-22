#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

"$BUILD_SCRIPTS_DIR/download.icrc1_ledger_suite.sh"
"$BUILD_SCRIPTS_DIR/build.vxp_index.args.sh"
