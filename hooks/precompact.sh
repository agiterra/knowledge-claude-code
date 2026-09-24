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
    # Own plugin copy first (this hook's version), else the NEWEST cached version by VERSION order.
    # A bare glob loop took the lexically FIRST match: 0.7.13 before 0.7.18, and 0.7.9 after it (Herald 2026-09-24).
    d="$(dirname "$0")/../node_modules/@agiterra/knowledge-tools/scripts/precompact-backup.sh"
    [ -f "$d" ] && BACKUP_SCRIPT="$d"
    if [ -z "$BACKUP_SCRIPT" ]; then
        d=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts/precompact-backup.sh 2>/dev/null | sort -V | tail -1)
        [ -n "$d" ] && [ -f "$d" ] && BACKUP_SCRIPT="$d"
    fi
fi

if [ -n "$BACKUP_SCRIPT" ]; then
    echo "$INPUT" | bash "$BACKUP_SCRIPT"
else
    echo "precompact: knowledge-tools backup script not found" >&2
fi

# Also checkpoint the vault (journal backup + commit + push). The transcript
# backup above is orthogonal — it captures pre-compact conversation state for
# recovery. Checkpoint captures on-disk vault state.
CHECKPOINT=""
for d in "$MARKETPLACE_DIR"/knowledge-tools/*/scripts/checkpoint.sh; do
    [ -f "$d" ] && CHECKPOINT="$d" && break
done
if [ -z "$CHECKPOINT" ]; then
    # Own plugin copy first (this hook's version), else the NEWEST cached version by VERSION order.
    # A bare glob loop took the lexically FIRST match: 0.7.13 before 0.7.18, and 0.7.9 after it (Herald 2026-09-24).
    d="$(dirname "$0")/../node_modules/@agiterra/knowledge-tools/scripts/checkpoint.sh"
    [ -f "$d" ] && CHECKPOINT="$d"
    if [ -z "$CHECKPOINT" ]; then
        d=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts/checkpoint.sh 2>/dev/null | sort -V | tail -1)
        [ -n "$d" ] && [ -f "$d" ] && CHECKPOINT="$d"
    fi
fi
if [ -n "$CHECKPOINT" ] && [ -n "$CWD" ]; then
    TIMESTAMP=$(date +%Y-%m-%d\ %H:%M)
    bash "$CHECKPOINT" --cwd "$CWD" --message "Auto-save vault before compact ($TIMESTAMP)" || true
fi
