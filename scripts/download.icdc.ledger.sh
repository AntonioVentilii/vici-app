#!/bin/bash

source "$(dirname "$0")/download.icdc.common.sh"

rm -f "$DIR"/ledger.*

"$SCRIPT_DIR/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/ledger.wasm.gz" "$DIR"/ledger.wasm.gz
gunzip -f "$DIR"/ledger.wasm.gz

"$SCRIPT_DIR/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/ledger.did" "$DIR"/ledger.did
