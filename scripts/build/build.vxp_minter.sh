#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

OUT_DIR="$PROJECT_ROOT/target/ic"
mkdir -p "$OUT_DIR"

POINTS_LOCAL="$PROJECT_ROOT/../vici-points"

if [[ -d "$POINTS_LOCAL" ]]; then
	# Local dev: compile from the sibling checkout for fast iteration on
	# Rust changes. Falls through to the release download for CI / fresh
	# boxes that don't have vici-points checked out.
	POINTS_ROOT="$(cd "$POINTS_LOCAL" && pwd)"
	(
		cd "$POINTS_ROOT"
		cargo build --release --target wasm32-unknown-unknown -p minter
	)
	cp "$POINTS_ROOT/target/wasm32-unknown-unknown/release/minter.wasm" "$OUT_DIR/vxp_minter.wasm"
	cp "$POINTS_ROOT/src/minter/minter.did" "$OUT_DIR/vxp_minter.did"
else
	# CI / fresh dev box: pull the prebuilt artifact from the vici-points
	# release. Mirrors what build.icdc.*.sh does for icdc-core.
	"$BUILD_SCRIPTS_DIR/download.vici_points.minter.sh"
fi

"$BUILD_SCRIPTS_DIR/build.vxp_minter.args.sh"
