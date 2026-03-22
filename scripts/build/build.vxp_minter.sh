#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

POINTS_ROOT="$(cd "$PROJECT_ROOT/../vici-points" && pwd)"
OUT_DIR="$PROJECT_ROOT/target/ic"
mkdir -p "$OUT_DIR"

(
	cd "$POINTS_ROOT"
	cargo build --release --target wasm32-unknown-unknown -p minter
)

cp "$POINTS_ROOT/target/wasm32-unknown-unknown/release/minter.wasm" "$OUT_DIR/vxp_minter.wasm"
cp "$POINTS_ROOT/src/minter/minter.did" "$OUT_DIR/vxp_minter.did"

"$BUILD_SCRIPTS_DIR/build.vxp_minter.args.sh"
