#!/bin/bash

source "$(dirname "$0")/download.icdc.common.sh"

rm -f "$DIR"/index.*

"$SCRIPT_DIR/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/index.wasm.gz" "$DIR"/index.wasm.gz
gunzip -f "$DIR"/index.wasm.gz

"$SCRIPT_DIR/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/index.did" "$DIR"/index.did
