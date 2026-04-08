#!/bin/bash
# SessionStart hook: ensure vectors.db exists.
# Runs vectorize --incremental if missing or empty.
# Fast (~5s) and no LLM needed — just local embeddings.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
VAULT_DIR="${CWD}/${KNOWLEDGE_VAULT:-.knowledge}"

if [ ! -d "$VAULT_DIR" ]; then
    exit 0
fi

VECTORS_DB="$VAULT_DIR/vectors.db"

if [ ! -f "$VECTORS_DB" ] || [ ! -s "$VECTORS_DB" ]; then
    SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1)
    if [ -n "$SCRIPTS" ]; then
        cd "$CWD"
        python3 "$SCRIPTS/vectorize.py" --incremental 2>&1 | tail -3
        echo "[knowledge] vectors.db built"
    fi
fi
