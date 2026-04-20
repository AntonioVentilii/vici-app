#!/usr/bin/env bash
#
# Registers (or reconciles) the "Vici" Engine on the icdc-core registry canister.
#
# The Vici Engine is the multi-tenant container on icdc-core that holds the role grants
# for users of this app. Once registered, the Juno satellite hook (`syncRoleToEngine`)
# can call `grant_engine_role` / `revoke_engine_role` to keep role assignments in sync
# with the Juno `roles` collection.
#
# Engine admins (i.e. principals that can grant/revoke roles on this engine):
#   1. The Juno satellite canister — so the `onSetDoc(ROLES)` hook can propagate changes.
#   2. The `SATELLITE_CONTROLLERS` principals (see src/lib/constants/controllers.constants.ts)
#      — so human admins can reach the engine directly via `dfx` if the hook breaks.
#   3. The current `dfx identity` that runs this script — typically already a controller,
#      added for convenience during local development.
#
# The engine declares `Creator` + `OracleAdmin` as `allowed_roles`. See `VICI_ENGINE_ID` in
# src/lib/constants/icdc.constants.ts (currently hardcoded to `eng_0` — safe because we
# reset the registry before first run and Vici is the first engine registered).
#
# Prerequisites:
#   - Registry canister deployed (`./scripts/deploy.sh`).
#   - Current `dfx` identity is a **controller** of the registry canister.
#
# Env:
#   VICI_JUNO_SATELLITE_PRINCIPAL — satellite canister id (default: local dev id).
#
# shellcheck source=scripts/lib/utils.sh
source "$(dirname "$0")/../lib/utils.sh" "$@"

set -euo pipefail

ENGINE_NAME="Vici"
SATELLITE="${VICI_JUNO_SATELLITE_PRINCIPAL:-auamu-4x777-77775-aaaaa-cai}"
DEPLOY_PRINCIPAL="$(dfx identity get-principal)"

# Human admins that should always be able to reach the engine directly via dfx.
# Keep in sync with src/lib/constants/controllers.constants.ts.
HUMAN_ADMINS=(
  "fi5zj-aw22p-wi734-xvevg-m74nl-hv4m7-x6p5d-nzdid-eafyu-retk2-nqe"
  "eqorn-r44tj-eoohr-ffgzt-avuid-bqfhx-wqmlw-xowii-gcqim-wvdnk-4qe"
)

build_admins_vec() {
  local -a principals=("$SATELLITE" "$DEPLOY_PRINCIPAL" "${HUMAN_ADMINS[@]}")

  local -a unique=()
  local seen
  for p in "${principals[@]}"; do
    [ -z "$p" ] && continue
    seen=0
    for u in "${unique[@]}"; do
      [ "$u" = "$p" ] && seen=1 && break
    done
    [ "$seen" -eq 0 ] && unique+=("$p")
  done

  local entries=""
  for p in "${unique[@]}"; do
    entries+="principal \"$p\"; "
  done
  echo "vec { $entries}"
}

ADMINS_VEC="$(build_admins_vec)"

echo "Starting Vici Engine initialization on $NETWORK..."
echo "  Engine name: $ENGINE_NAME"
echo "  Admins: $ADMINS_VEC"

# Look up whether an engine with this name is already registered.
LIST_OUT="$(dfx canister call --network "$NETWORK" registry list_engines 2>/dev/null || echo '')"

EXISTING_ID=""
if echo "$LIST_OUT" | grep -q "name = \"$ENGINE_NAME\""; then
  # Extract `engine_id = "eng_N"` from the record immediately preceding the matching name.
  # Format: `record { engine_id = "eng_0"; name = "Vici"; ... }`
  EXISTING_ID="$(echo "$LIST_OUT" | grep -Eo 'engine_id = "[^"]+"' | head -1 | sed 's/engine_id = "//;s/"//')"
fi

if [ -n "$EXISTING_ID" ]; then
  echo "Engine '$ENGINE_NAME' already registered: $EXISTING_ID"
  echo "Reconciling admins via add_engine_admins..."
  dfx canister call --network "$NETWORK" registry add_engine_admins "(record {
    engine_id = \"$EXISTING_ID\";
    principals = $ADMINS_VEC
  })" >/dev/null
  ENGINE_ID="$EXISTING_ID"
else
  echo "Registering new Vici engine..."
  REGISTER_RESULT="$(dfx canister call --network "$NETWORK" registry register_engine "(record {
    name = \"$ENGINE_NAME\";
    description = opt record { plain = \"Vici prediction markets\"; markdown = null; html = null };
    icon_url = null;
    admins = $ADMINS_VEC;
    allowed_roles = vec { variant { Creator }; variant { OracleAdmin } }
  })")"

  ENGINE_ID="$(echo "$REGISTER_RESULT" | grep -Eo '"[^"]*"' | head -1 | tr -d '"')"
  if [ -z "$ENGINE_ID" ]; then
    echo "ERROR: Failed to register engine. Response: $REGISTER_RESULT"
    exit 1
  fi
  echo "Registered engine: $ENGINE_ID"
fi

# Sanity check: warn (but do not fail) if the registered engine_id does not match the
# value hardcoded in src/lib/constants/icdc.constants.ts. The frontend uses the constant
# when calling `add_series` / `fork_series` so a mismatch means non-controller market
# creation will fail.
EXPECTED_ID="eng_0"
if [ "$ENGINE_ID" != "$EXPECTED_ID" ]; then
  echo ""
  echo "WARNING: registered engine_id ($ENGINE_ID) does not match the expected value ($EXPECTED_ID)."
  echo "  Update VICI_ENGINE_ID in src/lib/constants/icdc.constants.ts to '$ENGINE_ID'."
  echo ""
fi

echo "Vici Engine initialization complete."
