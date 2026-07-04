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

### Phase 1: Fast-save — BLOCKING, DO THIS FIRST

**Before anything else in this skill**, invoke `/knowledge:fast-save` using
the Skill tool. This is not optional and not paraphrasable. Use this exact
call:

```
Skill(skill="knowledge:fast-save")
```

Wait for it to complete. Verify session-state.md was updated and committed.
**Do NOT proceed to Phase 2 until fast-save has run and succeeded.**

If you skip this step, the next-you boots into stale state. Recycle's entire
purpose is preserving context for the fresh window — fast-save IS the
preservation. Skipping it is exactly the bug this skill was fixed to prevent
(shipped 2026-05-18 after the prior framing — "run checkpoint, editorial
scan is wasted" — caused two agents in one session to lose context).

What fast-save does:
- Updates `session-state.md` with what the next-you needs to pick up
- Queues unpersisted lessons into the Pending Lessons section
- Checkpoints (git add/commit/push)
- Skips the heavy stuff (journal entry, semantic indexing, vectorization)

If you want a heavier persist (journal entry + full editorial review), run
`/knowledge:save` manually before `/knowledge:recycle` instead. Recycle's
default is fast-save because the speed matches the moment.

### Phase 2: Send clear + boot via screen

Use GNU screen's `stuff` command to queue input to your own session. The STY
env var tells you your screen session name. TWO host-specific gotchas break a
naive `screen -X stuff` — both bit brioche on the patisserie host 2026-07-03,
and both must be resolved in the SAME command:

1. **SCREENDIR** — if unset, `screen` looks in the default macOS temp dir
   (`/var/folders/.../.screen`) and finds no socket, while the real one is under
   `$HOME/.screen` (where personai-launch/cc-launch create it). Set
   `SCREENDIR=${SCREENDIR:-$HOME/.screen}`.
2. **screen BINARY version** — your socket is created by the homebrew screen
   (5.x); a bare `screen` on PATH can resolve to macOS's `/usr/bin/screen`
   (4.x, because `/etc/zprofile`'s path_helper reorders PATH), and a 4.x binary
   against a 5.x socket throws `stuff` → "Operation not supported on socket"
   EVEN with SCREENDIR correct. Use the SAME binary that made the socket —
   prefer `/opt/homebrew/bin/screen`.

Resolve both inline, then stuff clear:

```
Bash(command="SCR=$(command -v /opt/homebrew/bin/screen 2>/dev/null || command -v screen); SCREENDIR=\"${SCREENDIR:-$HOME/.screen}\" \"$SCR\" -S \"${STY#*.}\" -X stuff '/clear\r'")
```

Then queue the boot command (same prefix):

```
Bash(command="SCR=$(command -v /opt/homebrew/bin/screen 2>/dev/null || command -v screen); SCREENDIR=\"${SCREENDIR:-$HOME/.screen}\" \"$SCR\" -S \"${STY#*.}\" -X stuff '/knowledge:boot\r'")
```

If STY is not set, OR the stuff still errors ("Operation not supported on
socket" / "No screen session found") on a host where the binary/SCREENDIR fix
doesn't apply, fall back to crew `pane_send` of `/clear` to your own pane if the
crew plugin is loaded; otherwise report that recycle can't self-clear on this
host and rely on the harness's auto-compaction (a fast-save already preserved
state, so nothing is lost).

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
- **Why the explicit Skill(...) call template in Phase 1**: v0.7.2 first
  shipped this fix as prose ("Run /knowledge:fast-save"). Madeleine ran the
  skill on 2026-05-19 and *skipped Phase 1 anyway* — the prose form was
  apparently skimmable, since reading "Run X" doesn't force invocation of X.
  v0.7.5 makes Phase 1 an unmissable Skill tool call template the agent must
  execute before Phase 2. Lesson: a skill that depends on the agent invoking
  another skill must specify the literal tool call, not narrate the
  dependency.
- **Why screen stuff, not pane_send**: screen is always available (agents run in
  screen sessions), whereas crew's pane_send requires the crew plugin loaded and
  the agent in a registered pane. BUT "screen stuff works everywhere" was too
  strong — on the fleet macOS hosts it only works with the RIGHT binary
  (homebrew 5.x, not `/usr/bin/screen` 4.x) and SCREENDIR set (see Phase 2's two
  gotchas). The naive `screen -X stuff` failed on patisserie 2026-07-03. Phase 2
  now resolves both inline; pane_send is the documented fallback when it still
  can't stuff. (This is the same wrong-screen-binary class as
  crew's remote-screen verification recipe — homebrew screen + SCREENDIR.)
- **Why not /exit + relaunch**: same process is cheaper and preserves the pane,
  the attached session, and the terminal state.
- **Failure mode**: if boot fails, the vault is still intact. Re-run
  `/knowledge:boot` manually.
