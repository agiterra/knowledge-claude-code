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

### Phase 1: Fast-save

Run `/knowledge:fast-save`. This updates session-state with what the next-you
needs to pick up, queues unpersisted lessons into the Pending Lessons section,
and checkpoints (git add/commit/push). It skips the heavy stuff (journal entry,
semantic indexing, vectorization).

The whole purpose of recycle is to preserve context across a fresh window.
session-state.md is the load-bearing artifact for next-session continuity,
and it has to be written at the recycle boundary — that's exactly where the
next session starts cold. A recycle that runs only mechanical persistence
throws away the very thing you're trying to preserve; the next-you boots
into stale state and rediscovers what you already learned.

If you want a heavier persist (journal entry + full editorial review), run
`/knowledge:save` manually before `/knowledge:recycle` instead — but recycle's
default path is fast-save because the speed matches the moment and session-state
update is the load-bearing artifact, not the journal entry.

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

- **Why fast-save, not checkpoint**: recycle is about preserving context across
  a fresh window, not shedding it. session-state.md is the artifact the next-you
  boots from; if recycle doesn't update it, the next-you boots into stale state
  and rediscovers what you already learned. The "editorial scan is wasted" earlier
  framing was wrong — the scan IS the preservation. Fast-save writes session-state,
  queues pending lessons, and checkpoints. The full `/knowledge:save` (journal
  entry + heavier editorial) is available manually for when it matters; not the
  default cadence at every recycle. Fixed 2026-05-18 after the bug bit two
  agents in one session.
- **Why screen stuff, not pane_send**: screen is always available (agents run in
  screen sessions). Crew's pane_send requires the crew plugin to be loaded and
  the agent to be in a registered pane. Screen stuff works everywhere.
- **Why not /exit + relaunch**: same process is cheaper and preserves the pane,
  the attached session, and the terminal state.
- **Failure mode**: if boot fails, the vault is still intact. Re-run
  `/knowledge:boot` manually.
