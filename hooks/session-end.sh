#!/bin/bash
# session-end.sh — Knowledge vault SessionEnd hook
#
# Runs when the session ends. The agent can no longer execute tools,
# so this is the safety net: commit any uncommitted vault changes.
#
# The rich editorial work should be done by /knowledge:save BEFORE exit.
# This hook is just the git commit that catches anything left over.
#
# Input (stdin JSON): session_id, cwd

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Determine vault directory
VAULT_DIR="$CWD/${KNOWLEDGE_VAULT:-.knowledge}"
if [ ! -d "$VAULT_DIR" ]; then
    exit 0
fi

# Check if vault is inside a git repo
cd "$CWD"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    exit 0
fi

# Check for uncommitted changes in the vault
if git diff --quiet -- "$VAULT_DIR" && git diff --cached --quiet -- "$VAULT_DIR" && [ -z "$(git ls-files --others --exclude-standard -- "$VAULT_DIR")" ]; then
    exit 0
fi

# Auto-commit vault changes
TIMESTAMP=$(date +%Y-%m-%d\ %H:%M)
git add "$VAULT_DIR"
git commit -m "Auto-save vault on session end ($TIMESTAMP)" --no-gpg-sign 2>/dev/null || true

echo "session-end: vault auto-committed at $TIMESTAMP"
