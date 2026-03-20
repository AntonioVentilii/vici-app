#!/usr/bin/env bash

source "$(dirname "$0")/utils.sh" "$@"

# This script initializes the registry canister with a list of markets from scripts/data/markets.json
# It uses dfx to call the add_series method for each market.

DATA_FILE="$SCRIPT_DIR/data/markets.json"

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

echo "Starting registry initialization on $NETWORK..."

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
        payout_unit = variant {
          Fiat = variant { Usd }
        };
        outcomes = $outcomes_candid;
        icon_url = null;
        balance_domain = variant { Settlement };
        oracle_source = \"Manual\";
    })"
done

echo "Registry initialization complete."
