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

For each lesson: decide where it belongs — the project's instruction file — whichever of `AGENTS.md` / `CLAUDE.md` already exists (`AGENTS.md` if neither). **Never create the other one:** with both present, Claude Code loads ONLY `CLAUDE.md`, so a new file silently shadows (or is shadowed by) the old — for values, a feedback-*.md
file for behavioral rules, project-*.md for project context, a new file for new
knowledge. Write it to the proper location now.

After processing, **clear the Pending Lessons section** of `session-state.md`.
The queue is empty. A lesson that survives in Pending Lessons after `/knowledge:save`
is a bug — it either should have been promoted to a vault file or consciously
deferred with a note.

A promise to remember without a file write is a lie.

## Phase 2: Update Session State

Read `.knowledge/meta/session-state.md` and update it:

0. **Apply the session-state contract FIRST** (canonical text: `/knowledge:fast-save` step 1). The file opens with
   `## HUMAN DIRECTIONS IN FORCE` (every standing operator direction, verbatim and dated, Urgent first, each with the
   state it demands; these outrank every hold an agent invented), then `## OPEN ASKS & AWAITED DECISIONS`, then
   `## HOLDS` (each with why / until / lifted-by). Write pointers, not narrative, and keep it to at most 15 KB. A save that drops a human
   direction or an Urgent item is a failed save.
1. **Move completed work** from Active Work to the History section (or to
   `.knowledge/meta/session-history.md` if the history section is getting long)
2. **Update active work** with current status, specific file paths, line numbers,
   and enough detail that a cold-booted agent can resume
3. **Add "Context for Next Session"** — the non-obvious things: why a decision
   was made, what was tried and failed, what the next step should be
4. **Update the timestamp** to today's date with a short label

Keep session-state.md within 15 KB. It's read on every boot, and bloat here
costs tokens on every future session. Then run the contract check and fix the file until it prints `CONTRACT OK`:

```
Bash(command="f=.knowledge/meta/session-state.md; h=$(grep -m1 '^## ' \"$f\"); n=$(wc -c < \"$f\" | tr -d ' '); miss=''; grep -q '^## OPEN ASKS & AWAITED DECISIONS' \"$f\" || miss=\"$miss asks\"; grep -q '^## HOLDS' \"$f\" || miss=\"$miss holds\"; if [ \"$h\" = '## HUMAN DIRECTIONS IN FORCE' ] && [ \"$n\" -le 15360 ] && [ -z \"$miss\" ]; then echo \"CONTRACT OK ($n B)\"; else echo \"CONTRACT FAIL: first section '${h:-none}', size $n B (limit 15360), missing:${miss:- nothing}\"; fi")
```

## Phase 3: Journal Session Summary

Run `/knowledge:journal` with:
- **Category**: `s/session`
- **Content**: 1-3 sentence summary of what happened this session.
  Include: what was built/decided/learned, any corrections received,
  any open threads left for next session.

## Phase 4: Checkpoint

Run `/knowledge:checkpoint` (or invoke its script directly) with a descriptive commit message:

```
Bash(command="SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | sort -V | tail -1); bash \"$SCRIPTS/checkpoint.sh\" --cwd . --message 'Session save: [brief description]'")
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
