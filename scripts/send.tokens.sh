#!/usr/bin/env bash

source "$(dirname "$0")/utils.sh" "$@"

# Utility Script: Send Tokens to a Local User
# Particularly handy after installing the canisters for the first time or being forced by dfx to clean the local state.

# Usage: ./scripts/send.tokens.sh [principal] [amount] [--network local|staging]

if [[ -z "${1:-}" || "$1" == --* ]]; then
  # If first arg is empty or a flag, we might need to prompt or check next args
  if [[ -n "${2:-}" && "$2" != --* ]]; then
      PRINCIPAL=$2
  else
      read -r -p "Enter the PRINCIPAL: " PRINCIPAL
  fi
else
  PRINCIPAL=$1
fi

CKUSDC_AMOUNT=30000000 # default

# Find first two non-option arguments
args=()
for arg in "$@"; do
    if [[ "$arg" != --* ]]; then
        args+=("$arg")
    fi
done

if [[ ${#args[@]} -ge 1 ]]; then
    PRINCIPAL=${args[0]}
fi

if [[ ${#args[@]} -ge 2 ]]; then
    CKUSDC_AMOUNT=$(echo "${args[1]} * 1000000" | bc)
fi

echo "Sending $CKUSDC_AMOUNT to $PRINCIPAL on $NETWORK..."

dfx canister call ckusdc_ledger --network "$NETWORK" icrc1_transfer "(record {from=null; to=record { owner= principal \"$PRINCIPAL\";}; amount=$CKUSDC_AMOUNT; fee=null; memo=null; created_at_time=null;})"
