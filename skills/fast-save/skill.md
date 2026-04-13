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

### 1. Persist unpersisted learnings

Scan the conversation for things that should be written to the vault:

- **Operator corrections** — "no, not that", "don't do X", "stop doing Y"
- **Confirmed approaches** — "yes exactly", "perfect", accepted without pushback
- **Promises to remember** — "I'll remember", "noted", "got it"
- **New facts about people, projects, or infrastructure**

For each one found: write it NOW to the appropriate vault file.
A promise to remember without a file write is a lie.

### 2. Update session state

Read `.knowledge/meta/session-state.md` and update it:

- Move completed work out of DO FIRST
- Update active work with current status
- Update the timestamp

Keep it under 80 lines. Focus on what the next-you needs to DO.

### 3. Commit

```
Bash(command="cd .knowledge && git add -A && git diff --cached --stat && git commit -m 'Fast save: [brief label]' && git push 2>/dev/null || true")
```

### 4. Done

Report what changed in one line. No confirmation ceremony.
