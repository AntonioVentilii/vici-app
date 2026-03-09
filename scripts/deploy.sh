#!/usr/bin/env bash
set -euxo pipefail

# The ckETH Minter requires that the ckETH Ledger canister is created before it
dfx canister create cketh_ledger --network local
dfx deploy cketh_minter --network local --upgrade-unchanged --mode reinstall --yes
dfx deploy cketh_ledger --network local --upgrade-unchanged --mode reinstall --yes

dfx deploy ckusdc_ledger --network local --upgrade-unchanged --mode reinstall --yes
dfx deploy ckusdc_index --network local --upgrade-unchanged --mode reinstall --yes

# The vUSD Minter requires that the vUSD Ledger and the Clearing canisters are created before it
dfx canister create ledger --network local
dfx canister create clearing --network local
dfx deploy minter --network local --upgrade-unchanged --mode reinstall --yes
dfx deploy ledger --network local --upgrade-unchanged --mode reinstall --yes
dfx deploy index --network local --upgrade-unchanged --mode reinstall --yes

dfx deploy clearing --network local --upgrade-unchanged
dfx deploy registry --network local --upgrade-unchanged
