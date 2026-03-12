#!/usr/bin/env bash

source "$(dirname "$0")/utils.sh" "$@"

echo "Restarting ICDC on $NETWORK..."

# 1. Pre-create canisters to satisfy dependency requirements
echo "Creating canister IDs for ledger and clearing..."
dfx canister create ledger --network "$NETWORK"
dfx canister create clearing --network "$NETWORK"

# 2. Reinstall core canisters
echo "Deploying minter (reinstall)..."
dfx deploy minter --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes

echo "Deploying ledger (reinstall)..."
dfx deploy ledger --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes

echo "Deploying index (reinstall)..."
dfx deploy index --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes

# 3. Deploy remaining canisters
echo "Deploying clearing..."
dfx deploy clearing --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes

echo "Deploying registry..."
dfx deploy registry --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes

# 4. Initialize the environment
echo "Initializing registry and clearing..."

if [ -f "scripts/init.registry.sh" ]; then
    bash scripts/init.registry.sh "$@"
else
    echo "Warning: scripts/init.registry.sh not found."
fi

if [ -f "scripts/init.clearing.sh" ]; then
    bash scripts/init.clearing.sh "$@"
else
    echo "Warning: scripts/init.clearing.sh not found."
fi

echo "ICDC restart and initialization complete!"
