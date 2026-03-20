#!/bin/bash

source "$(dirname "$0")/download.icdc.common.sh"

rm -f "$DIR"/clearing.*

"$SCRIPT_DIR/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/clearing.wasm.gz" "$DIR"/clearing.wasm.gz
gunzip -f "$DIR"/clearing.wasm.gz

"$SCRIPT_DIR/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/clearing.did" "$DIR"/clearing.did
