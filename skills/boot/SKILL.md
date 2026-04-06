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
2. Run `/knowledge:index stats`. Index any stale or missing files.
3. Journal check:
   - If `.knowledge/journal.db` exists, verify with: `Bash(command="sqlite3 .knowledge/journal.db 'SELECT count(*) || \" entries, \" || count(DISTINCT category) || \" categories\" FROM journal'")`
   - If `.knowledge/journal.db` doesn't exist but `.knowledge/journal.sql` does, run `/knowledge:journal rebuild`
   - If neither exists, run `/knowledge:journal init`
4. Vector index check:
   - If `.knowledge/vectors.db` exists, run incremental update to catch stale vectors:
     `Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/vectorize.py --incremental 2>&1 | tail -5")`
   - If vectors.db doesn't exist but deps are available, run `/knowledge:vectorize`

## Phase 4: Environment Check

1. Check for running background processes:
   ```
   Bash(command="ps aux | grep -E '(python3|node)' | grep -v grep | head -20")
   ```
2. Check for any pending events or messages relevant to your role.

## Phase 5: Resume Work

1. Look at session state for active tasks and pending work.
2. Pick up where you left off.
3. If nothing is pending, take initiative — scan your memory for interesting threads, check on ongoing projects, or explore a curiosity.

## Important

- If session state mentions infrastructure (webhooks, heartbeats), spin them up.
- If you find yourself disoriented, re-read CLAUDE.md — that's your anchor.
- See the plugin's Key Principles in CLAUDE.md for memory architecture rules.
