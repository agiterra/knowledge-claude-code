---
description: Quick session checkpoint — persists learnings and updates session state. Skips journal, indexing, and vectorization. Use before recycle or as a periodic snapshot.
allowed-tools: Bash, Read, Write, Edit
---

# Knowledge Fast Save

Persist learnings + update session state + commit. Skip the heavy stuff.

This is the speed-optimized save for recycle and periodic checkpoints.
It captures everything important (learnings, session state) but skips
journal entries, semantic indexing, and vectorization.

For a full save with journal and editorial review, use `/knowledge:save`.

## Steps

### 1. Queue unpersisted lessons into session-state

Scan the conversation for things that should become vault knowledge but aren't yet:

- **Operator corrections** — "no, not that", "don't do X", "stop doing Y"
- **Confirmed approaches** — "yes exactly", "perfect", accepted without pushback
- **Promises to remember** — "I'll remember", "noted", "got it"
- **New facts about people, projects, or infrastructure**

Don't create new vault files here. Fast-save is fast because it defers
editorial judgment. Instead, append each lesson to a **Pending Lessons**
section at the bottom of `session-state.md`:

```
## Pending Lessons (for /knowledge:save to process)

- 2026-04-15 13:47 — [kind: feedback|project|reference] brief description.
  Raw evidence: quote or context. Where it likely belongs: filename.md.
```

The next `/knowledge:save` will promote these into proper vault files. If
recycle or compaction happens before that, the Pending Lessons section
survives in session-state and the next-you picks them up on boot.

A lesson captured into session-state pending is persisted. A lesson only
in conversation memory is a lie.

### 2. Update session state

Read `.knowledge/meta/session-state.md` and update it:

- Move completed work out of DO FIRST
- Update active work with current status
- Update the timestamp

Keep it under 80 lines (the Pending Lessons section counts against this — if
it's growing, you owe a full `/knowledge:save`). Focus on what the next-you
needs to DO.

### 3. Checkpoint

```
Bash(command="SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1); bash \"$SCRIPTS/checkpoint.sh\" --cwd . --message 'Fast save: [brief label]'")
```

Checkpoint handles: `journal.py backup`, `git add`, commit if changes, push if origin set. Idempotent.

### 4. Done

Report what changed in one line. No confirmation ceremony.
