---
description: Deliberately save session state before exit. Updates session-state.md, persists learnings, journals a summary, and commits the vault.
allowed-tools: Bash, Read, Write, Edit, Skill
---

# Knowledge Save

Run this before ending a session to deliberately preserve context.
This is the editorial counterpart to the PreCompact hook's crash dump.

## Phase 1: Unpersisted Learnings

Scan your conversation for things that should have been persisted but weren't:

1. **Operator corrections** — "no, not that", "don't do X", "stop doing Y"
2. **Confirmed approaches** — "yes exactly", "perfect", accepted without pushback
3. **Promises to remember** — "I'll remember", "noted", "got it"
4. **New facts about people, projects, or infrastructure**

For each one found: persist it NOW. Write to the appropriate vault file
(CLAUDE.md for values, conventions.md for behavioral rules, a new file
for new knowledge). A promise to remember without a file write is a lie.

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

## Phase 4: Commit the Vault

```
Bash(command="SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1); [ -n \"$SCRIPTS\" ] && bash \"$SCRIPTS/journal-dump.sh\"; cd .knowledge && git add -A && git diff --cached --stat")
```

If there are changes, commit and push:

```
Bash(command="cd .knowledge && git commit -m 'Session save: [brief description]' && git push 2>/dev/null || true")
```

If no changes, skip silently.

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
