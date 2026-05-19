#!/bin/bash
# SessionStart hook: derive CC auto-memory MEMORY.md from vault state.
#
# Why: Claude Code's built-in auto-memory at ~/.claude/projects/<slug>/memory/
# loads at session start and the system prompt instructs Claude to write
# learnings there ("I'll remember"). Without coordination, the harness and
# this plugin compete for the same writes — agents end up writing operator
# preferences to auto-memory AND journaling them, drifting over time.
#
# Resolution: make auto-memory a *derived view* of the vault. The vault is
# canonical (portable, provenance-bearing, indexed). Auto-memory becomes
# a regenerated digest, gives CC sessions a warm pre-boot context window,
# and converges single-source-of-truth on the vault.
#
# Behavior: regenerates MEMORY.md only. Hand-written individual memory
# files (feedback_*.md, user_*.md, project_*.md, reference_*.md) are
# preserved and indexed by description.
#
# Opt out: set KNOWLEDGE_AUTO_MEMORY_BRIDGE=0
# Manual override: hand-edit MEMORY.md and remove the AUTO-GEN marker —
#   subsequent runs will skip it.

set -euo pipefail

# Opt-out
if [ "${KNOWLEDGE_AUTO_MEMORY_BRIDGE:-1}" = "0" ]; then
    exit 0
fi

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
[ -z "$CWD" ] && exit 0

VAULT_DIR="${CWD}/${KNOWLEDGE_VAULT:-.knowledge}"
[ -d "$VAULT_DIR" ] || exit 0

# Compute CC auto-memory dir from CWD (CC slug = path with / → -)
SLUG="$(echo "$CWD" | sed 's|/|-|g')"
MEMORY_DIR="${HOME}/.claude/projects/${SLUG}/memory"
[ -d "$MEMORY_DIR" ] || exit 0   # CC hasn't initialized auto-memory here

MEMORY_FILE="${MEMORY_DIR}/MEMORY.md"
AUTO_GEN_MARKER="<!-- AUTO-GENERATED from .knowledge/ by knowledge-claude-code/auto-memory-bridge -->"

# Respect manual override: if MEMORY.md exists and doesn't have the marker,
# the user is managing it by hand. Don't touch.
if [ -f "$MEMORY_FILE" ] && ! head -1 "$MEMORY_FILE" | grep -qF "$AUTO_GEN_MARKER"; then
    exit 0
fi

JOURNAL_DB="${VAULT_DIR}/journal.db"
SESSION_STATE="${VAULT_DIR}/meta/session-state.md"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# ── Header ────────────────────────────────────────────────────────────────
{
    echo "$AUTO_GEN_MARKER"
    echo "<!-- Last regenerated: $(date -u +%Y-%m-%dT%H:%M:%SZ). Edit the vault, not this file. -->"
    echo
} >> "$TMP"

# ── Standing operator preferences (existing hand-written memory files) ────
PREF_FILES="$(find "$MEMORY_DIR" -maxdepth 1 -type f -name '*.md' \
    ! -name 'MEMORY.md' 2>/dev/null | sort)"
if [ -n "$PREF_FILES" ]; then
    echo "## Standing operator preferences (pre-boot)" >> "$TMP"
    echo >> "$TMP"
    while IFS= read -r f; do
        base="$(basename "$f")"
        # Read description from frontmatter if present, else first non-frontmatter line
        desc="$(awk '/^description: /{sub(/^description: /,""); print; exit}' "$f")"
        if [ -z "$desc" ]; then
            desc="$(awk '/^---$/{c++; next} c>=2 && NF{print; exit}' "$f")"
        fi
        # Strip surrounding double-quotes that the CC harness adds when normalizing
        desc="${desc#\"}"
        desc="${desc%\"}"
        # Truncate long descriptions
        if [ "${#desc}" -gt 140 ]; then
            desc="${desc:0:137}..."
        fi
        echo "- [${base%.md}](${base}) — ${desc}" >> "$TMP"
    done <<< "$PREF_FILES"
    echo >> "$TMP"
fi

# ── Recent journal entries ────────────────────────────────────────────────
if [ -f "$JOURNAL_DB" ]; then
    echo "## Recent journal — canonical at \`${VAULT_DIR}/journal.db\`" >> "$TMP"
    echo >> "$TMP"
    sqlite3 "$JOURNAL_DB" "SELECT id, date(timestamp), category, substr(summary, 1, 160) FROM journal ORDER BY id DESC LIMIT 5" 2>/dev/null \
      | awk -F'|' '{ printf "- `j:%s` [%s, %s] %s\n", $1, $3, $2, $4 }' >> "$TMP"
    echo >> "$TMP"
    echo "Fetch full body: \`python3 \$KNOWLEDGE_SCRIPTS/journal.py get <id>\`" >> "$TMP"
    echo >> "$TMP"
fi

# ── Live state from session-state.md ──────────────────────────────────────
if [ -f "$SESSION_STATE" ]; then
    echo "## Live state — canonical at \`${SESSION_STATE}\`" >> "$TMP"
    echo >> "$TMP"
    # Active Work section through the next ## header
    awk '
        /^## Active Work/   { p=1; print; next }
        /^## /              { if (p) p=0 }
        p
    ' "$SESSION_STATE" | head -20 >> "$TMP"
    echo >> "$TMP"
fi

# ── Vault references ──────────────────────────────────────────────────────
{
    echo "## Key vault references"
    echo
    echo "- Vault root: \`${VAULT_DIR}\`"
    echo "- Journal DB: \`${JOURNAL_DB}\` (regenerable from \`journal.sql\`)"
    echo "- Vectors DB: \`${VAULT_DIR}/vectors.db\` (regenerable from markdown via \`vectorize.py\`)"
} >> "$TMP"

# Atomic install
mv "$TMP" "$MEMORY_FILE"
trap - EXIT

echo "[knowledge] auto-memory MEMORY.md regenerated from vault"
