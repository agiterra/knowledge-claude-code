#!/bin/bash
# SessionStart hook: ensure vectors.db exists.
# Runs vectorize --incremental if missing or empty.
# Fast (~5s) and no LLM needed — just local embeddings.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
# Vault via the shared knowledge-tools primitive (absolute KNOWLEDGE_VAULT wins; else $CWD/.knowledge).
__RV="$(dirname "$0")/../node_modules/@agiterra/knowledge-tools/scripts/resolve-vault.sh"
if [ -f "$__RV" ]; then . "$__RV"; else VAULT_DIR="${KNOWLEDGE_VAULT:-.knowledge}"; case "$VAULT_DIR" in /*) :;; *) VAULT_DIR="$CWD/$VAULT_DIR";; esac; fi
# A shared checkout reached only via cwd (KNOWLEDGE_VAULT unset) is never written — not even this hook's own
# log (2026-10-02, Brioche 649049; predicate from knowledge-tools >= 0.2.14, absent on the fallback path).
if type vault_is_implicit_shared_root >/dev/null 2>&1 && vault_is_implicit_shared_root; then
    echo "ensure-vectors: $VAULT_DIR is a SHARED root's vault reached via cwd (KNOWLEDGE_VAULT unset) — not writing" >&2
    exit 0
fi

if [ ! -d "$VAULT_DIR" ]; then
    exit 0
fi

VECTORS_DB="$VAULT_DIR/vectors.db"

if [ ! -f "$VECTORS_DB" ] || [ ! -s "$VECTORS_DB" ]; then
    SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | sort -V | tail -1)
    if [ -n "$SCRIPTS" ]; then
        cd "$CWD"
        python3 "$SCRIPTS/vectorize.py" --incremental 2>&1 | tail -3
        echo "[knowledge] vectors.db built"
    fi
fi
