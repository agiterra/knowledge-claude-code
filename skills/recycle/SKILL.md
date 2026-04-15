---
description: Save session state, then clear and re-boot in place. The lightweight alternative to handoff — same process, fresh context, vault as continuity.
allowed-tools: Bash, Read, Write, Edit, Skill
---

# Knowledge Recycle

Fast-save, clear, boot. In place. No spawn, no quiz, no swap.

This is the everyday alternative to `/knowledge:handoff`. Handoff spawns a twin
and quizzes it before cutover — insurance against a broken boot. Recycle trusts
the vault: if save persisted the state and boot can restore it, there's no need
for a second process to prove the first one works.

## When to use which

- **Recycle** — default. Context is getting heavy, you want a fresh window,
  nothing risky is in flight.
- **Handoff** — escape hatch. You're about to attempt something where a broken
  boot would be expensive, and you want the old instance alive as fallback.

## Sequence

### Phase 1: Checkpoint

Run `/knowledge:checkpoint`. This is pure persistence — `journal.py backup`, git
add, commit, push. No conversation scan, no session-state edit.

Editorial scan at recycle time is wasted effort: you're shedding this context
either way, and a learning that wasn't persisted before recycle was going to be
lost to compaction too. Discipline is upstream, not here.

If you have important unpersisted learnings, run `/knowledge:save` BEFORE
`/knowledge:recycle`.

### Phase 2: Send clear + boot via screen

Use GNU screen's `stuff` command to queue input to your own session. The STY
env var tells you your screen session name:

```
Bash(command="screen -S \"$(echo $STY | cut -d. -f2-)\" -X stuff '/clear\r'")
```

Then queue the boot command:

```
Bash(command="screen -S \"$(echo $STY | cut -d. -f2-)\" -X stuff '/knowledge:boot\r'")
```

If STY is not set (not in a screen session), fall back to crew pane_send if
available, or report that recycle can't proceed.

### Phase 3: Exit cleanly

After sending, end your response immediately. Do not add more tool calls — the
CLI needs to process the queued input. The next thing you'll see is the boot
output in your fresh context.

## Design notes

- **Why checkpoint, not fast-save**: recycle is about shedding context. Any
  editorial scan at this point is wasted — a learning that's still in-context
  instead of in-vault is unpersisted by definition, and compaction would lose
  it just the same. Checkpoint is the honest version: flush what's already
  on disk, boot fresh, trust the vault. `/knowledge:save` before `/knowledge:recycle`
  is the escape hatch for agents who know they have unpersisted state.
- **Why screen stuff, not pane_send**: screen is always available (agents run in
  screen sessions). Crew's pane_send requires the crew plugin to be loaded and
  the agent to be in a registered pane. Screen stuff works everywhere.
- **Why not /exit + relaunch**: same process is cheaper and preserves the pane,
  the attached session, and the terminal state.
- **Failure mode**: if boot fails, the vault is still intact. Re-run
  `/knowledge:boot` manually.
