#!/usr/bin/env bash

set -euo pipefail

echo "Starting clearing initialization..."

REGISTRY=$(dfx canister id registry)

echo "Setting registry canister ID $REGISTRY in clearing canister..."
dfx canister call --network local clearing set_registry_canister "(principal \"$REGISTRY\")"

echo "Clearing initialization complete."
