#!/usr/bin/env bash

source "$(dirname "$0")/utils.sh" "$@"

# The ckETH Minter requires that the ckETH Ledger canister is created before it
dfx canister create cketh_ledger --network "$NETWORK"
dfx deploy cketh_minter --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes
dfx deploy cketh_ledger --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes

dfx deploy ckusdc_ledger --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes
dfx deploy ckusdc_index --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes

# The vUSD Minter requires that the vUSD Ledger and the Clearing canisters are created before it
dfx canister create ledger --network "$NETWORK"
dfx canister create clearing --network "$NETWORK"
dfx deploy minter --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes
dfx deploy ledger --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes
dfx deploy index --network "$NETWORK" --upgrade-unchanged --mode reinstall --yes

dfx deploy clearing --network "$NETWORK" --upgrade-unchanged
dfx deploy registry --network "$NETWORK" --upgrade-unchanged
