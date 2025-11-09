#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"/frontend

npx wrangler pages deploy --project-name cf-fantasy-trade-gm-agent
