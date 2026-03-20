#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIR="$PROJECT_ROOT/target/icdc"

mkdir -p "$DIR"

ICDC_CORE_VERSION="v0.0.3"
