#!/usr/bin/env bash

source "$(dirname "$0")/../lib/utils.sh" "$@"

# This script initializes the registry canister:
#   1. Registers the VICI_ORACLE_V1 oracle (needed to settle markets).
#   2. Authorises the deploying dfx principal, plus any additional principals
#      supplied via the ORACLE_EXTRA_PRINCIPALS env variable
#      (comma or space-separated list of Internet Identity principals).
#   3. Seeds markets from scripts/data/markets.json using add_series.
#
# Notes on oracle authorisation:
#   The deploying dfx principal is almost never the same as the Internet Identity
#   principal the admin uses in the browser. To let an admin settle markets from
#   the UI, either:
#     - Pre-authorise their II principal here via ORACLE_EXTRA_PRINCIPALS, or
#     - Use the Admin > Oracle Authorisation panel in the app after deploy.

ORACLE_ID="VICI_ORACLE_V1"
DATA_FILE="$SCRIPT_DIR/data/markets.json"

# Keep in sync with src/lib/constants/icdc.constants.ts. The script runs as the registry
# canister controller, so `engine_id` is optional (controllers bypass the check), but we
# attribute seeded markets to the Vici engine for consistency with frontend-created ones.
VICI_ENGINE_ID="${VICI_ENGINE_ID:-eng_0}"

if [ ! -f "$DATA_FILE" ]; then
  echo "Error: $DATA_FILE not found."
  exit 1
fi

# Function to slugify title
slugify() {
  printf '%s' "$1" |
    tr '[:upper:]' '[:lower:]' |
    sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

DEPLOY_PRINCIPAL=$(dfx identity get-principal)

# Build a Candid `vec { principal "..."; ... }` list from dfx principal and any
# additional principals provided via ORACLE_EXTRA_PRINCIPALS (comma/space-separated).
build_principal_vec() {
  local -a principals=("$DEPLOY_PRINCIPAL")

  if [ -n "${ORACLE_EXTRA_PRINCIPALS:-}" ]; then
    local extras
    extras="${ORACLE_EXTRA_PRINCIPALS//,/ }"
    # shellcheck disable=SC2206
    principals+=($extras)
  fi

  # Deduplicate while preserving order.
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

echo "Starting registry initialization on $NETWORK..."

# --- Oracle setup ---------------------------------------------------------

PRINCIPAL_VEC=$(build_principal_vec)

echo "Registering oracle $ORACLE_ID with authorised principals:"
echo "  $PRINCIPAL_VEC"

# add_oracle fails with OracleAlreadyExists on re-run; we swallow the error and
# reconcile the principal list via manage_oracle_principals below.
dfx canister call --network "$NETWORK" registry add_oracle "(record {
    oracle_id = \"$ORACLE_ID\";
    metadata = record {
        name = \"Vici Oracle v1\";
        description = opt record {
            plain = \"Default settlement oracle for Vici prediction markets\";
            markdown = null;
            html = null
        };
        website = null
    };
    authorized_principals = $PRINCIPAL_VEC
})" 2>/dev/null || true

# Ensure all expected principals are present (no-op if oracle was freshly created).
dfx canister call --network "$NETWORK" registry manage_oracle_principals "(record {
    oracle_id = \"$ORACLE_ID\";
    add_principals = $PRINCIPAL_VEC;
    remove_principals = vec {}
})" >/dev/null

# --- Markets seeding ------------------------------------------------------

# Registry and clearing only accept USD payout_unit today (see icdc-core registry add_series).

length=$(jq '. | length' "$DATA_FILE")

for ((i = 0; i < $length; i++)); do
  market=$(jq -c ".[$i]" "$DATA_FILE")

  title=$(jq -r '.title' <<<"$market" | sed 's/\\/\\\\/g; s/"/\\"/g')
  description=$(jq -r '.description' <<<"$market" | sed 's/\\/\\\\/g; s/"/\\"/g')

  expiration_iso=$(echo "$market" | jq -r '.expiryDate')

  underlying=$(slugify "$title")

  expiration_seconds=$(date -j -f "%Y-%m-%dT%H:%M:%S.000Z" "$expiration_iso" "+%s" 2>/dev/null || date -d "$expiration_iso" "+%s")
  expiration_ns=$((expiration_seconds * 1000000000))

  echo "Adding market: $title ($underlying)"

  outcomes_list=$(jq -r '.outcomes[]?' <<<"$market" | sed 's/"/\\"/g' | awk '{id=tolower($0); gsub(/[^a-z0-9]+/, "-", id); gsub(/^-+|-+$/, "", id); printf "record { id=\"%s\"; title=\"%s\"; description=null; icon_url=null }; ", id, $0}')
  if [ -n "$outcomes_list" ]; then
    outcomes_candid="opt vec { $outcomes_list }"
    payoff_type="variant { Categorical }"
  else
    outcomes_candid="null"
    payoff_type="variant { Binary }"
  fi

  dfx canister call --network "$NETWORK" registry add_series "(record {
        title = \"$title\";
        description = record { plain = \"$description\"; html = null; markdown = null };
        expiry_ns = $expiration_ns;
        underlying = \"$underlying\";
        strike = null;
        banner_url = null;
        price_precision = 8 : nat8;
        payoff_type = $payoff_type;
        payout_unit = variant { Fiat = variant { Usd } };
        outcomes = $outcomes_candid;
        icon_url = null;
        balance_domain = variant { ViciXp };
        oracle_source = \"$ORACLE_ID\";
        trading_access = vec { variant { Open } };
        engine_id = opt \"$VICI_ENGINE_ID\";
    })"
done

echo "Registry initialization complete."
