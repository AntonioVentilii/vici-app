#!/bin/bash

source "$(dirname "$0")/download.icdc.common.sh"

rm -f "$DIR"/registry.*

"$SCRIPT_DIR/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/registry.wasm.gz" "$DIR"/registry.wasm.gz
gunzip -f "$DIR"/registry.wasm.gz

"$SCRIPT_DIR/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/registry.did" "$DIR"/registry.did
