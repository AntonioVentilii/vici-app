#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

OUT_DIR="$PROJECT_ROOT/target/ic"
mkdir -p "$OUT_DIR"

ICRC_LOCAL="$PROJECT_ROOT/../vici-icrc"

if [[ -d "$ICRC_LOCAL" ]]; then
	# Local dev: compile from the sibling checkout for fast iteration on
	# Rust changes. Falls through to the release download for CI / fresh
	# boxes that don't have vici-icrc checked out.
	ICRC_ROOT="$(cd "$ICRC_LOCAL" && pwd)"
	(
		cd "$ICRC_ROOT"
		cargo build --release --target wasm32-unknown-unknown -p minter
	)
	cp "$ICRC_ROOT/target/wasm32-unknown-unknown/release/minter.wasm" "$OUT_DIR/vici_minter.wasm"
	cp "$ICRC_ROOT/src/minter/minter.did" "$OUT_DIR/vici_minter.did"
else
	# CI / fresh dev box: pull the prebuilt artifact from the vici-icrc
	# release. Mirrors what build.icdc.*.sh does for icdc-core.
	"$BUILD_SCRIPTS_DIR/download.vici_icrc.minter.sh"
fi

"$BUILD_SCRIPTS_DIR/build.vici_minter.args.sh"
