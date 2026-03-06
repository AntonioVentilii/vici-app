#!/bin/bash

# Utility Script: Send Tokens to a Local User
# Particularly handy after installing the canisters for the first time or being forced by dfx to clean the local state.

if [ -z "$1" ]; then
  read -r -p "Enter the PRINCIPAL: " PRINCIPAL
else
  PRINCIPAL=$1
fi

# ckUSDC amount
if [ -z "$2" ]; then
  CKUSDC_AMOUNT=30000000 # 30 ckUSDC (6 decimals)
else
  CKUSDC_AMOUNT=$(echo "$2 * 1000000" | bc)
fi

DFX_NETWORK=local

dfx canister call ckusdc_ledger --network "$DFX_NETWORK" icrc1_transfer "(record {from=null; to=record { owner= principal \"$PRINCIPAL\";}; amount=$CKUSDC_AMOUNT; fee=null; memo=null; created_at_time=null;})"
