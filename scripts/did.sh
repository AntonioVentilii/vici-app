#!/usr/bin/env bash

source "$(dirname "$0")/utils.sh" "$@"

./scripts/import-candid.sh --"$NETWORK"

./scripts/compile-idl-js.sh --"$NETWORK"
