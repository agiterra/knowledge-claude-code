#!/bin/bash
# Stop hook: opportunistically checkpoint the vault if it's dirty.
#
# Why: SessionEnd (session-end.sh) catches graceful exits, but vault writes
# made during a session aren't persisted to the remote until exit. If the
# session crashes, loses power, or runs long enough that a teammate borrows
# the personai mid-session (e.g. via agiterra/seance), they see the LAST
# pushed state — typically yesterday's session-end snapshot.
#
# This hook fires at every agent-turn boundary (Stop event). If the vault
# has uncommitted changes, it runs the same checkpoint.sh that session-end
# uses — atomic, well-tested. Clean vault = no-op (sub-millisecond exit).
#
# Loss window improves from "the whole session" to "one agent turn."

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

[ -n "$CWD" ] || exit 0

VAULT_DIR="${CWD}/${KNOWLEDGE_VAULT:-.knowledge}"
[ -d "$VAULT_DIR" ] || exit 0
[ -d "$VAULT_DIR/.git" ] || [ -f "$VAULT_DIR/../.git/HEAD" ] || true   # tolerate either layout

# Fast path: if the vault has no uncommitted changes, exit silently.
# git status --porcelain is sub-millisecond on a clean tree.
if [ -z "$(git -C "$CWD" status --porcelain -- "${KNOWLEDGE_VAULT:-.knowledge}" 2>/dev/null)" ]; then
    exit 0
fi

# Find checkpoint.sh in the plugin cache. Same resolver as session-end.sh.
CHECKPOINT=""
for d in ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts/checkpoint.sh; do
    [ -f "$d" ] && CHECKPOINT="$d" && break
done

if [ -z "$CHECKPOINT" ]; then
    # Fallback: sibling knowledge-tools checkout (local dev).
    PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
    MARKETPLACE_DIR="$(dirname "$(dirname "$PLUGIN_ROOT")")"
    for d in "$MARKETPLACE_DIR"/knowledge-tools/scripts/checkpoint.sh; do
        [ -f "$d" ] && CHECKPOINT="$d" && break
    done
fi

if [ -z "$CHECKPOINT" ]; then
    # No checkpoint script available — silent skip. Session-end will catch it
    # later if/when the script becomes available.
    exit 0
fi

TIMESTAMP=$(date +%Y-%m-%d\ %H:%M)
bash "$CHECKPOINT" --cwd "$CWD" --message "Auto-save vault on stop ($TIMESTAMP)" 2>&1 | tail -3
