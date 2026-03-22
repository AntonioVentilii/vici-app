#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

ICRC_ROOT="$(cd "$PROJECT_ROOT/../vici-icrc" && pwd)"
OUT_DIR="$PROJECT_ROOT/target/ic"
mkdir -p "$OUT_DIR"

(
	cd "$ICRC_ROOT"
	cargo build --release --target wasm32-unknown-unknown -p minter
)

cp "$ICRC_ROOT/target/wasm32-unknown-unknown/release/minter.wasm" "$OUT_DIR/vici_minter.wasm"
cp "$ICRC_ROOT/src/minter/minter.did" "$OUT_DIR/vici_minter.did"

"$BUILD_SCRIPTS_DIR/build.vici_minter.args.sh"
