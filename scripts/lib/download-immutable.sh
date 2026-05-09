#!/usr/bin/env bash
set -euo pipefail

print_help() {
  cat <<-EOF

		Downloads a file to a given destination.

		This is optimized for the case where the data at the URL is immutable.
		If that exact same URL has been previously downloaded to that exact same location,
		the download will be skipped.
	EOF

  print_usage
}

print_usage() {
  cat <<-EOF

		Usage:
		  $(basename "$0") <URL> <DOWNLOAD_PATH>
	EOF
}

[[ "${1:-}" != "--help" ]] || {
  print_help
  exit 0
}

(($# == 2)) || {
  echo "ERROR: There should be two arguments."
  print_usage

  exit 1
}

URL="$1"
DOWNLOAD_DESTINATION="$2"
URL_HASH="$(echo "$URL" | sha256sum | awk '{print substr($1,1,10)}')"
REAL_DOWNLOAD_DESTINATION="$DOWNLOAD_DESTINATION.$URL_HASH"

# If `GH_TOKEN` (or `GITHUB_TOKEN`) is set, send it as a bearer token so this
# script can fetch assets from PRIVATE GitHub releases (vici-points,
# vici-icrc, …). For public releases (icdc-core) the header is harmless.
CURL_AUTH=()
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -n "$TOKEN" ]]; then
  CURL_AUTH=(-H "Authorization: Bearer $TOKEN")
fi

if test -e "$REAL_DOWNLOAD_DESTINATION"; then
  echo "Download already exists for: '$DOWNLOAD_DESTINATION'  Skipping..."
else
  echo "Downloading ${URL} --> ${DOWNLOAD_DESTINATION}"
  mkdir -p "$(dirname "$DOWNLOAD_DESTINATION")"
  TMP_DOWNLOAD_DESTINATION="$(mktemp "$REAL_DOWNLOAD_DESTINATION.XXXXX")"
  curl --fail -sSL "${CURL_AUTH[@]}" "$URL" >"$TMP_DOWNLOAD_DESTINATION"
  mv "$TMP_DOWNLOAD_DESTINATION" "$REAL_DOWNLOAD_DESTINATION"
fi

ln -s -f "$(basename "$REAL_DOWNLOAD_DESTINATION")" "$DOWNLOAD_DESTINATION"
