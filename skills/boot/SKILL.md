---
description: Full boot sequence — restores session state and memory continuity after context compaction.
allowed-tools: Bash, Read, Write, Skill, Agent, mcp__plugin_crew_crew__pane_register, mcp__plugin_crew_crew__agent_register
---

# Knowledge Boot

Run this after context compaction to restore continuity.

## Phase 1: Core State (always read)

1. Read `.knowledge/meta/session-state.md` — what you were doing before compaction. If it doesn't exist, tell the user to run `/knowledge:init`.

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
        KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1)
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
   mcp__plugin_wire_wire__heartbeat_list({ agent_id: "<your AGENT_ID>" })
   ```
   Compare each heartbeat's `last_fired` against its `cron` interval. Anything that never fired or is stale beyond its interval is broken — flag it and consider re-creating it with `heartbeat_create`. An empty list means none are registered — fine if your role doesn't use periodic self-wakeups; flag it if session state says you should have one.
3. **Verify the knowledge-indexer sidecar (KX) is alive** for the current project. The sidecar is keyed by cwd hash; if the process died, vault writes will silently NOT be indexed. (The not-registered case must print explicitly — a pipe into `xargs -I{}` runs nothing on empty input, so the old form printed nothing exactly when the sidecar was missing entirely.)
   ```
   Bash(command="cwd=\"$(pwd)\"; id=\"kx-$(echo -n \"$cwd\" | shasum -a 256 | cut -c1-8)\"; pid=$(sqlite3 ~/.wire/crews.db \"SELECT screen_pid FROM agents WHERE id='$id'\" 2>/dev/null); if [ -z \"$pid\" ]; then echo \"KX $id NOT REGISTERED — knowledge-indexer isn't installed for this project, or the sidecar was never launched\"; elif ps -p \"$pid\" >/dev/null 2>&1; then echo \"KX $id alive (pid $pid)\"; else echo \"KX $id DEAD (stale pid $pid) — indexing is stalled; call knowledge-indexer launch()\"; fi")
   ```
   NOT REGISTERED is fine when the knowledge-indexer plugin isn't installed for this project (indexing rides the boot/save flows instead); flag it if the project normally runs one.
4. Check for any pending events or messages relevant to your role.

## Phase 5: Resume Work

1. Look at session state for active tasks and pending work.
2. Pick up where you left off.
3. If nothing is pending, take initiative — scan your memory for interesting threads, check on ongoing projects, or explore a curiosity.

## Important

- If session state mentions infrastructure (webhooks, heartbeats), spin them up.
- If you find yourself disoriented, re-read CLAUDE.md — that's your anchor.
- See the plugin's Key Principles in CLAUDE.md for memory architecture rules.
