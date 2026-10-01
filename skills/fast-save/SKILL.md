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

### 1. The session-state contract — FIRST, every time

This contract is canonical here. `/knowledge:save` and `/knowledge:recycle` apply it too.

The operator, 2026-10-01: *"the session state needs to carry all important information (e.g. this issue is
urgent, overriding holds) and also as compact as possible, or there's no point in recycling."* And:
*"If you're following directions from a human, those directions need to carry."*

`session-state.md` opens with these three sections, in this order, before anything else:

1. **`## HUMAN DIRECTIONS IN FORCE`** — the FIRST `## ` heading in the file, always.
   - What goes in: every standing direction from your operator(s) that still applies. Quote it verbatim, with the date and who gave it.
   - Order: Urgent items first. Each one names the state it demands, e.g. `lane running: yes (eng28-4509)` or
     `lane running: no (why; restart time)`.
   - Precedence: a human direction outranks every hold you or another agent invented. If one conflicts with a hold, the
     direction wins; write down that it did.
   - If there are none, write `(none)`. A missing section looks exactly like a dropped one.
2. **`## OPEN ASKS & AWAITED DECISIONS`** — every open ask (id, who it went to, what it asks) and every decision
   you are waiting on. `(none)` if empty.
3. **`## HOLDS`** — every hold, each with **why / until / lifted-by**. A hold missing any of the three is not
   written: either complete it or drop it. A hold nobody can lift is a permanent stop that nobody chose.

After those come DO FIRST and active work, written as pointers (paths, ids, message numbers, commits), not narrative.

**Size: at most 15 KB** (15,360 bytes). Move history out to `.knowledge/meta/session-history.md` (or a dated
archive file) now, not later. A state file the next-you can't read cheaply defeats the recycle.

**A save that drops a human direction or an Urgent item is a FAILED save,** however clean the rest is.

Check it mechanically. Don't eyeball it:

```
Bash(command="f=.knowledge/meta/session-state.md; h=$(grep -m1 '^## ' \"$f\"); n=$(wc -c < \"$f\" | tr -d ' '); miss=''; grep -q '^## OPEN ASKS & AWAITED DECISIONS' \"$f\" || miss=\"$miss asks\"; grep -q '^## HOLDS' \"$f\" || miss=\"$miss holds\"; if [ \"$h\" = '## HUMAN DIRECTIONS IN FORCE' ] && [ \"$n\" -le 15360 ] && [ -z \"$miss\" ]; then echo \"CONTRACT OK ($n B)\"; else echo \"CONTRACT FAIL: first section '${h:-none}', size $n B (limit 15360), missing:${miss:- nothing}\"; fi")
```

`CONTRACT FAIL` means you're not done. Fix the file and run the check again.

### 2. Queue unpersisted lessons into session-state

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

### 3. Update session state

Read `.knowledge/meta/session-state.md` and update it:

- Bring the three contract sections (step 1) up to date first
- Move completed work out of DO FIRST
- Update active work with current status
- Update the timestamp

Keep it within the 15 KB contract limit (the Pending Lessons section counts against
it — if it's growing, you owe a full `/knowledge:save`). Focus on what the next-you
needs to DO. Re-run the step 1 check after this edit.

### 4. Checkpoint

```
Bash(command="SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | sort -V | tail -1); bash \"$SCRIPTS/checkpoint.sh\" --cwd . --message 'Fast save: [brief label]'")
```

Checkpoint handles: `journal.py backup`, `git add`, commit if changes, push if origin set. Idempotent.

### 5. Done

Report what changed in one line, including the `CONTRACT OK (<n> B)` line. No confirmation ceremony.
