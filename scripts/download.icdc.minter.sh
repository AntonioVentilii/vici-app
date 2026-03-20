#!/bin/bash

source "$(dirname "$0")/download.icdc.common.sh"

rm -f "$DIR"/minter.*

"$SCRIPT_DIR/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/minter.wasm.gz" "$DIR"/minter.wasm.gz
gunzip -f "$DIR"/minter.wasm.gz

"$SCRIPT_DIR/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/minter.did" "$DIR"/minter.did
