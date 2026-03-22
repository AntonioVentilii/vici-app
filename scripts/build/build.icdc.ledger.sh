#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

"$BUILD_SCRIPTS_DIR/download.icdc.ledger.sh"
"$BUILD_SCRIPTS_DIR/build.icdc.ledger.args.sh"
