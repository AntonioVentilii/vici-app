#!/bin/bash

source "$(dirname "$0")/download.icdc.common.sh"

rm -f "$DIR"/clearing.*

"$SCRIPTS_LIB/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/clearing.wasm.gz" "$DIR"/clearing.wasm.gz
gunzip -f "$DIR"/clearing.wasm.gz

"$SCRIPTS_LIB/download-immutable.sh" "https://github.com/AntonioVentilii/icdc-core/releases/download/$ICDC_CORE_VERSION/clearing.did" "$DIR"/clearing.did
