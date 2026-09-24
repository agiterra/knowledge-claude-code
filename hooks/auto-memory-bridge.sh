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

# Vault via the shared knowledge-tools primitive (absolute KNOWLEDGE_VAULT wins; else $CWD/.knowledge).
__RV="$(dirname "$0")/../node_modules/@agiterra/knowledge-tools/scripts/resolve-vault.sh"
if [ -f "$__RV" ]; then . "$__RV"; else VAULT_DIR="${KNOWLEDGE_VAULT:-.knowledge}"; case "$VAULT_DIR" in /*) :;; *) VAULT_DIR="$CWD/$VAULT_DIR";; esac; fi
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
# Rendered LAST (below), once the other sections' size is known: the loader truncates MEMORY.md at
# ~24.4 KB AND 200 lines — two dimensions, both enforced here (Brioche 628672: a 191-entry index was
# 48.6 KB and lost 91 lines at every boot). Newest memories first; overflow is named, never silent.
MAX_BYTES="${KNOWLEDGE_AUTO_MEMORY_MAX_BYTES:-22000}"
MAX_LINES="${KNOWLEDGE_AUTO_MEMORY_MAX_LINES:-180}"
PREFS_TMP="$(mktemp)"
TAIL_TMP="$(mktemp)"
trap 'rm -f "$TMP" "$PREFS_TMP" "$TAIL_TMP"' EXIT
HEAD_TMP="$TMP"
TMP="$TAIL_TMP"

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

# ── Render the preference index into whatever budget the other sections left ──
used_bytes=$(cat "$HEAD_TMP" "$TAIL_TMP" | wc -c | tr -d ' ')
used_lines=$(cat "$HEAD_TMP" "$TAIL_TMP" | wc -l | tr -d ' ')
python3 - "$MEMORY_DIR" "$((MAX_BYTES - used_bytes))" "$((MAX_LINES - used_lines))" > "$PREFS_TMP" <<'PY'
import os, re, sys
mdir, byte_budget, line_budget = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
TITLE_MAX, LINE_MAX = 48, 160
def desc_of(path):
    txt = open(path, encoding="utf-8", errors="replace").read()
    m = re.search(r"^description:\s*(.*)$", txt, re.M)
    if m: d = m.group(1).strip()
    else:
        body = re.split(r"^---\s*$", txt, maxsplit=2, flags=re.M)
        d = next((l.strip() for l in (body[-1] if len(body) > 2 else txt).splitlines() if l.strip()), "")
    return d.strip('"').strip()
def clip(s, n): return s if len(s) <= n else s[: n - 1].rstrip() + "…"
files = [f for f in os.listdir(mdir) if f.endswith(".md") and f != "MEMORY.md" and os.path.isfile(os.path.join(mdir, f))]
files.sort(key=lambda f: os.path.getmtime(os.path.join(mdir, f)), reverse=True)   # newest first
if not files: sys.exit(0)
out = ["## Standing operator preferences (pre-boot)", ""]
spent = sum(len((l + "\n").encode()) for l in out) ; lines = len(out)
# room for the overflow note, sized from its real text (it carries the directory path)
reserve = len(f"- … {len(files)} older memories not listed (index budget {byte_budget} B / {line_budget} lines); all are in {mdir}\n".encode()) + 2
kept = 0
for f in files:
    title = clip(f[:-3], TITLE_MAX)
    prefix = f"- [{title}]({f}) — "
    line = prefix + clip(desc_of(os.path.join(mdir, f)), max(24, LINE_MAX - len(prefix)))
    b = len((line + "\n").encode())
    if spent + b + reserve > byte_budget or lines + 3 > line_budget: break   # +1 this line, +1 note, +1 blank
    out.append(line); spent += b; lines += 1; kept += 1
if kept < len(files):
    out.append(f"- … {len(files) - kept} older memories not listed (index budget {byte_budget} B / {line_budget} lines); all are in {mdir}")
out.append("")
print("\n".join(out))
PY
cat "$HEAD_TMP" "$PREFS_TMP" "$TAIL_TMP" > "$MEMORY_FILE.tmp.$$" && mv "$MEMORY_FILE.tmp.$$" "$MEMORY_FILE"
rm -f "$HEAD_TMP" "$PREFS_TMP" "$TAIL_TMP"
trap - EXIT

echo "[knowledge] auto-memory MEMORY.md regenerated from vault: $(wc -c < "$MEMORY_FILE" | tr -d ' ') B, $(wc -l < "$MEMORY_FILE" | tr -d ' ') lines (budget ${MAX_BYTES} B / ${MAX_LINES} lines)"
