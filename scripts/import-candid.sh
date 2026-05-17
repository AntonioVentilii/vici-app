#!/usr/bin/env bash

source "$(dirname "$0")/lib/utils.sh" "$@"

download_did() {
  local raw_url="$1"
  local out_filename="$2"
  local dir="$3"

  local out_path="${dir}/${out_filename}"

  local repo=$(echo "$raw_url" | awk -F '/' '{print $4"/"$5}')
  local branch=$(echo "$raw_url" | awk -F '/' '{print $6}')
  local file_path=$(echo "$raw_url" | awk -F "$branch/" '{print $2}')

  local api_url="https://api.github.com/repos/${repo}/commits?path=${file_path}&sha=${branch}"
  local commit_hash=$(curl -s "$api_url" | jq -r '.[0].sha')

  if [ -z "$commit_hash" ]; then
    echo "Failed to retrieve commit hash for ${file_path} in ${repo}."
    return 1
  fi

  echo "Downloading ${raw_url} -> REPO_ROOT/${out_path}"
  {
    echo "// Generated from ${repo} commit ${commit_hash} for file '${file_path}'"
    echo ""
    curl -s "$raw_url"
  } >"${out_path}"
}

cd "$SCRIPT_DIR/.."

mkdir -p src/declarations/registry
download_did https://raw.githubusercontent.com/AntonioVentilii/icdc-core/main/src/registry/registry.did "registry.did" "src/declarations/registry"

mkdir -p src/declarations/clearing
download_did https://raw.githubusercontent.com/AntonioVentilii/icdc-core/main/src/clearing/clearing.did "clearing.did" "src/declarations/clearing"
