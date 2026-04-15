---
description: Deliberately save session state before exit. Updates session-state.md, persists learnings, journals a summary, and commits the vault.
allowed-tools: Bash, Read, Write, Edit, Skill
---

# Knowledge Save

Run this before ending a session to deliberately preserve context.
This is the editorial counterpart to the PreCompact hook's crash dump.

## Phase 1: Process Pending Lessons

Two inputs feed this phase:

1. **The Pending Lessons section of `session-state.md`** — anything earlier
   fast-saves queued for editorial processing. Read this first.
2. **Your conversation** — scan for lessons that aren't yet in session-state
   either: operator corrections ("no, not that"), confirmed approaches
   ("yes exactly"), promises to remember, new facts about people / projects /
   infrastructure.

For each lesson: decide where it belongs — CLAUDE.md for values, a feedback-*.md
file for behavioral rules, project-*.md for project context, a new file for new
knowledge. Write it to the proper location now.

After processing, **clear the Pending Lessons section** of `session-state.md`.
The queue is empty. A lesson that survives in Pending Lessons after `/knowledge:save`
is a bug — it either should have been promoted to a vault file or consciously
deferred with a note.

A promise to remember without a file write is a lie.

## Phase 2: Update Session State

Read `.knowledge/meta/session-state.md` and update it:

1. **Move completed work** from Active Work to the History section (or to
   `.knowledge/meta/session-history.md` if the history section is getting long)
2. **Update active work** with current status, specific file paths, line numbers,
   and enough detail that a cold-booted agent can resume
3. **Add "Context for Next Session"** — the non-obvious things: why a decision
   was made, what was tried and failed, what the next step should be
4. **Update the timestamp** to today's date with a short label

Keep session-state.md under 80 lines. It's read on every boot — bloat here
costs tokens on every future session.

## Phase 3: Journal Session Summary

Run `/knowledge:journal` with:
- **Category**: `s/session`
- **Content**: 1-3 sentence summary of what happened this session.
  Include: what was built/decided/learned, any corrections received,
  any open threads left for next session.

## Phase 4: Checkpoint

Run `/knowledge:checkpoint` (or invoke its script directly) with a descriptive commit message:

```
Bash(command="SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1); bash \"$SCRIPTS/checkpoint.sh\" --cwd . --message 'Session save: [brief description]'")
```

Checkpoint handles the mechanics: `journal.py backup`, `git add`, `git commit` if changes, `git push` if origin exists. Idempotent — skips silently on no-op.

## Phase 5: Confirm

Tell the agent (yourself) what was saved:
- Number of learnings persisted
- Session state changes
- Journal entry number
- Vault commit hash (if any)

## When to Run

- Before `/exit` or ending a session
- Before `/knowledge:handoff` (save state for the twin to inherit)
- Anytime you want to checkpoint your work
- The SessionEnd hook runs a minimal version automatically, but this
  skill does the rich editorial work that a shell script can't

## Important

- This is YOUR editorial judgment about what matters. Not a mechanical dump.
- Session state should tell the next-you what to DO, not what happened.
- If you're unsure whether something is worth saving, save it. Disk is cheap.
  Context window is not.
