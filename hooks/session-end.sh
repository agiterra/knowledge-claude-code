#!/bin/bash
# session-end.sh — Knowledge vault SessionEnd hook
#
# Safety net for vault persistence: runs checkpoint (journal backup + git add
# + commit + push) when the session ends. The agent can no longer execute
# tools, so this catches anything /knowledge:save didn't.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

[ -n "$CWD" ] || exit 0

# Find checkpoint.sh in the plugin cache.
CHECKPOINT=""
# Own plugin copy first (this hook's version), else the NEWEST cached version by VERSION order.
# A bare glob loop took the lexically FIRST match: 0.7.13 before 0.7.18, and 0.7.9 after it (Herald 2026-09-24).
d="$(dirname "$0")/../node_modules/@agiterra/knowledge-tools/scripts/checkpoint.sh"
[ -f "$d" ] && CHECKPOINT="$d"
if [ -z "$CHECKPOINT" ]; then
    d=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts/checkpoint.sh 2>/dev/null | sort -V | tail -1)
    [ -n "$d" ] && [ -f "$d" ] && CHECKPOINT="$d"
fi

if [ -z "$CHECKPOINT" ]; then
    # Fallback: sibling knowledge-tools checkout (local dev).
    PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
    MARKETPLACE_DIR="$(dirname "$(dirname "$PLUGIN_ROOT")")"
    for d in "$MARKETPLACE_DIR"/knowledge-tools/scripts/checkpoint.sh; do
        [ -f "$d" ] && CHECKPOINT="$d" && break
    done
fi

if [ -z "$CHECKPOINT" ]; then
    echo "session-end: checkpoint.sh not found; vault not saved" >&2
    exit 0
fi

TIMESTAMP=$(date +%Y-%m-%d\ %H:%M)
bash "$CHECKPOINT" --cwd "$CWD" --message "Auto-save vault on session end ($TIMESTAMP)"
