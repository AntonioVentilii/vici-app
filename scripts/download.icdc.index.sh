#!/bin/bash

source "$(dirname "$0")/download.icdc.common.sh"

rm -f "$DIR"/index.*

scripts/download-immutable.sh "https://github.com/dfinity/ic/releases/download/ledger-suite-icrc-2025-06-19/ic-icrc1-index-ng.wasm.gz" "$DIR"/index.wasm.gz
gunzip -f "$DIR"/index.wasm.gz

scripts/download-immutable.sh "https://github.com/dfinity/ic/releases/download/ledger-suite-icrc-2025-06-19/index-ng.did" "$DIR"/index.did
