#!/usr/bin/env bash

# This script initializes the registry canister with a list of markets from scripts/data/markets.json
# It uses dfx to call the add_series method for each market.

set -euo pipefail

DATA_FILE="scripts/data/markets.json"

if [ ! -f "$DATA_FILE" ]; then
    echo "Error: $DATA_FILE not found."
    exit 1
fi

# Function to slugify title
slugify() {
    printf '%s' "$1" \
        | tr '[:upper:]' '[:lower:]' \
        | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

# Iterate over each market in the JSON file
# Using jq to extract fields.
# dfx call registry add_series '(record {
#   title = "title";
#   description = "desc";
#   expiry = 123456789;
#   underlying = "underlying";
#   strike = null;
#   payoff_type = variant { Binary };
#   settlement_asset = variant { CkUsdc };
#   oracle_source = "Internal";
# })'

echo "Starting registry initialization..."

# Get the number of markets
length=$(jq '. | length' "$DATA_FILE")

for (( i=0; i<$length; i++ )); do
    market=$(jq -c ".[$i]" "$DATA_FILE")

    title=$(jq -r '.title' <<<"$market" | sed 's/\\/\\\\/g; s/"/\\"/g')
    description=$(jq -r '.description' <<<"$market" | sed 's/\\/\\\\/g; s/"/\\"/g')

    expiration_iso=$(echo "$market" | jq -r '.expiration')

    # Create a verbose underlying ID (slug)
    underlying=$(slugify "$title")

    # Convert ISO expiration to milliseconds
    # macOS date command (BSD)
    expiration_seconds=$(date -j -f "%Y-%m-%dT%H:%M:%S.000Z" "$expiration_iso" "+%s" 2>/dev/null || date -d "$expiration_iso" "+%s")
    expiration_ns=$((expiration_seconds * 1000000000))

    echo "Adding market: $title ($underlying)"

    dfx canister call --network local registry add_series "(record {
        title = \"$title\";
        description = \"$description\";
        expiry_ns = $expiration_ns;
        underlying = \"$underlying\";
        strike = null;
        payoff_type = variant { Binary };
        settlement_asset = variant { Icp };
        oracle_source = \"Manual\";
    })"
done

echo "Registry initialization complete."
