---
description: Full boot sequence — restores session state and memory continuity after context compaction.
allowed-tools: Bash, Read, Write, Skill, Agent, mcp__plugin_crew_crew__pane_register, mcp__plugin_crew_crew__agent_register
---

# Knowledge Boot

Run this after context compaction to restore continuity.

## Phase 1: Core State (always read)

1. Read `.knowledge/meta/session-state.md` — what you were doing before compaction. If it doesn't exist, tell the user to run `/knowledge:init`.
2. **Read `## HUMAN DIRECTIONS IN FORCE` first, and act on it first.** It is the first section of the file under the
   session-state contract (`/knowledge:fast-save` step 1). Every direction there outranks every hold below it,
   including holds your predecessor wrote. An Urgent item that says `lane running: no` is the work, not a note.
   If the section is missing, say so in your first report: a missing section looks exactly like a dropped one.
   Then do two things: reconstruct the directions from the recovery data or the journal, and ask your operator for
   any you can't recover. Check `## OPEN ASKS & AWAITED DECISIONS` and `## HOLDS` next. A hold with no why / until /
   lifted-by is suspect; re-judge it, don't just obey it.

## Phase 1.5: Recovery Data (if available)

Check for pre-compaction recovery data left by the PreCompact hook:

1. If `.knowledge/meta/precompact/latest-recovery.md` exists, read it.
2. If it points to a recovery file, read that too — it contains the last
   few assistant messages before compaction, which may include context
   not captured in session-state.md.
3. Cross-reference with the compaction summary: if the recovery data
   mentions work or decisions not reflected in session-state, persist
   them now.

## Phase 2: Archival Memory Scan (build a mental index)

Run `/knowledge:scan` to get a table of contents of archival memory files without loading them. This keeps boot cost constant as memory grows.

## Phase 3: Memory Integrity

1. Check the compaction summary AND recovery data for unpersisted learnings — look for "I'll remember," "lesson learned," "note to self," operator corrections, or confirmed preferences that weren't written to `.knowledge/`. Persist them NOW, before continuing. A promise to remember without a file write is a lie.
2. Semantic index + vectors — launch as a **background agent** so boot isn't blocked:
   ```
   Agent(
     description="Index and vectorize vault",
     run_in_background=true,
     model="haiku",
     prompt="You are maintaining a knowledge vault's search indexes. Run these steps:

     1. Resolve scripts path:
        KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | sort -V | tail -1)
        If empty, try: /Users/tim/Projects/Agiterra/knowledge-tools/scripts

     2. Scan for unindexed files:
        python3 $KNOWLEDGE_SCRIPTS/index-vault.py scan
        For each NEEDS_INDEX file, read it and generate:
        - A one-line semantic summary
        - 10-25 keywords (concrete terms, abstract themes, synonyms, abbreviations)
        - Related file paths from the vault (if any)
        Then update: python3 $KNOWLEDGE_SCRIPTS/index-vault.py update '<path>' '<summary>' '<keywords-csv>' '<related-csv>'

     3. Run incremental vector update:
        python3 $KNOWLEDGE_SCRIPTS/vectorize.py --incremental

     Report what you indexed and vectorized when done."
   )
   ```
   Do NOT wait for this agent to finish — continue boot immediately.
3. Journal check:
   - If `.knowledge/journal.db` exists, verify with: `Bash(command="sqlite3 .knowledge/journal.db 'SELECT count(*) || \" entries, \" || count(DISTINCT category) || \" categories\" FROM journal'")`
   - If `.knowledge/journal.db` doesn't exist but `.knowledge/journal.sql` does, run `/knowledge:journal rebuild`
   - If neither exists, run `/knowledge:journal init`

## Phase 4: Environment Check

1. Check for running background processes:
   ```
   Bash(command="ps aux | grep -E '(python3|node)' | grep -v grep | head -20")
   ```
2. **Verify Wire heartbeats are still firing** (not just registered). Registration is persistent; a cron scheduler crash leaves you silently starving for pokes. Use the wire plugin's MCP tool — the raw `/heartbeats` endpoint requires a Bearer JWT, so an unauthenticated curl gets an auth-error object, chokes iterating it, and reports "no heartbeats" no matter the truth (a silent false-negative):
   ```
   mcp__plugin_wire_wire__heartbeat_list({ agent_id: "<your AGENT_ID>", summary: true })
   ```
   Compare each heartbeat's `last_fired` against its `cron` interval. Anything that never fired or is stale beyond its interval is broken — flag it and consider re-creating it with `heartbeat_create`. An empty list means none are registered — fine if your role doesn't use periodic self-wakeups; flag it if session state says you should have one.
3. **Verify the knowledge-indexer sidecar (KX) is alive** for the current project, and whether a host sweep covers the vault. The sidecar is keyed by cwd hash; if it died, vault writes will silently NOT be indexed.
   A missing crews.db row is NOT a dead sidecar: sidecar launches never self-register, and the crew reaper drops unregistered rows. So the check falls back to the live screen `wire-kx-<hash>` (measured 2026-09-30: every persona's sidecar alive, none with a row, and boot reported all of them NOT REGISTERED). Codex and Grok personas never fire the Claude indexing hook, so their coverage is the host `kx-sweep` job when one exists; its last line for this vault is printed too. Every branch prints; an empty result would be read as healthy.
   ```bash
   cwd="$(pwd)"; id="kx-$(printf %s "$cwd" | shasum -a 256 | cut -c1-8)"
   pid=$(sqlite3 ~/.wire/crews.db "SELECT screen_pid FROM agents WHERE id='$id'" 2>/dev/null)
   scr=$(pgrep -f "dmS wire-$id " 2>/dev/null | head -1)
   if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then echo "KX $id alive (registered, pid $pid)"
   elif [ -n "$scr" ]; then echo "KX $id alive (screen wire-$id, pid $scr) — no crews.db row; sidecars do not self-register, so this is NOT a failure"
   elif [ -n "$pid" ]; then echo "KX $id DEAD (stale pid $pid, no screen wire-$id) — indexing is stalled; call knowledge-indexer launch()"
   else echo "KX $id NOT RUNNING (no crews.db row, no screen wire-$id)"; fi
   log=/opt/agiterra/watch/state/kx-sweep.log; tag="$(id -un)@$(basename "$cwd")"
   if [ -r "$log" ]; then line=$(grep -F "$tag: scan" "$log" | tail -1); echo "kx-sweep: ${line:-no line for $tag — this vault is NOT covered by the host sweep}"; fi
   ```
   Read it as: `alive (registered …)` or `alive (screen …)` = fine. `DEAD` = call knowledge-indexer `launch()`. `NOT RUNNING` = fine only when the knowledge-indexer plugin isn't installed for this project, or when the kx-sweep line is fresh (its timestamp within about an hour) with `needs=0`. A kx-sweep line saying `NOT covered` while the sidecar is also NOT RUNNING means nothing indexes this vault: flag it.
4. Check for any pending events or messages relevant to your role.

## Phase 5: Resume Work

1. Look at session state for active tasks and pending work.
2. Pick up where you left off.
3. If nothing is pending, take initiative — scan your memory for interesting threads, check on ongoing projects, or explore a curiosity.

## Important

- If session state mentions infrastructure (webhooks, heartbeats), spin them up.
- If you find yourself disoriented, re-read AGENTS.md/CLAUDE.md — that's your anchor.
- See the plugin's Key Principles in AGENTS.md/CLAUDE.md for memory architecture rules.
