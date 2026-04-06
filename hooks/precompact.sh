#!/bin/bash
# precompact.sh — Knowledge vault PreCompact hook
#
# Runs before context compaction. Reads hook input from stdin (JSON),
# backs up the transcript, and extracts session state markers.
#
# Delegates to knowledge-tools precompact-backup.sh if available.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Find the knowledge-tools scripts directory
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKETPLACE_DIR="$(dirname "$(dirname "$PLUGIN_ROOT")")"

# Look for knowledge-tools backup script
BACKUP_SCRIPT=""
for d in "$MARKETPLACE_DIR"/knowledge-tools/*/scripts/precompact-backup.sh; do
    [ -f "$d" ] && BACKUP_SCRIPT="$d" && break
done

if [ -z "$BACKUP_SCRIPT" ]; then
    # Fallback: search plugin cache
    for d in ~/.claude/plugins/cache/*/knowledge-tools/*/scripts/precompact-backup.sh; do
        [ -f "$d" ] && BACKUP_SCRIPT="$d" && break
    done
fi

if [ -n "$BACKUP_SCRIPT" ]; then
    echo "$INPUT" | bash "$BACKUP_SCRIPT"
else
    echo "precompact: knowledge-tools backup script not found" >&2
fi
