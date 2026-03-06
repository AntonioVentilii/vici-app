#!/usr/bin/env bash
set -euxo pipefail

# The ckETH Minter requires that the ckETH Ledger canister is created before it
dfx canister create cketh_ledger --network local
dfx deploy cketh_minter --network local --upgrade-unchanged --mode reinstall --yes
dfx deploy cketh_ledger --network local --upgrade-unchanged --mode reinstall --yes

dfx deploy ckusdc_ledger --network local --upgrade-unchanged --mode reinstall --yes
dfx deploy ckusdc_index --network local --upgrade-unchanged --mode reinstall --yes

dfx deploy clearing --network local --upgrade-unchanged
dfx deploy registry --network local --upgrade-unchanged
