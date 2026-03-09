#!/bin/bash

source "$(dirname "$0")/download.icdc.common.sh"

rm -f "$DIR"/ledger.*

scripts/download-immutable.sh "https://github.com/dfinity/ic/releases/download/ledger-suite-icrc-2025-06-19/ic-icrc1-ledger.wasm.gz" "$DIR"/ledger.wasm.gz
gunzip -f "$DIR"/ledger.wasm.gz

scripts/download-immutable.sh "https://github.com/dfinity/ic/releases/download/ledger-suite-icrc-2025-06-19/ledger.did" "$DIR"/ledger.did
