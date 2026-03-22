#!/usr/bin/env bash

source "$(dirname "$0")/lib/utils.sh" "$@"

"$SCRIPT_DIR/import-candid.sh" --"$NETWORK"

"$SCRIPT_DIR/compile-idl-js.sh" --"$NETWORK"
