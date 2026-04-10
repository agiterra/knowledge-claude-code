---
description: Save session state, then clear and re-boot in place. The lightweight alternative to handoff — same process, fresh context, vault as continuity.
allowed-tools: Bash, Read, Skill, mcp__plugin_crew_crew__agent_list, mcp__plugin_crew_crew__pane_send
---

# Knowledge Recycle

Save, clear, boot. In place. No spawn, no quiz, no swap.

This is the everyday alternative to `/knowledge:handoff`. Handoff spawns a twin
and quizzes it before cutover — insurance against a broken boot. Recycle trusts
the vault: if `/knowledge:save` persisted the state and `/knowledge:boot` can
restore it, there's no need for a second process to prove the first one works.

Continuity lives in the vault, not in a warm process.

## When to use which

- **Recycle** — default. Context is getting heavy, you want a fresh window,
  nothing risky is in flight.
- **Handoff** — escape hatch. You're about to attempt something where a broken
  boot would be expensive, and you want the old instance alive as fallback
  until the new one proves it works.

## Sequence

### Phase 1: Save

Run `/knowledge:save`. This is non-negotiable — recycle without save is just
amnesia. The save skill handles unpersisted learnings, session-state updates,
the journal entry, and the vault commit.

If save fails or reports nothing to commit, continue anyway — the vault is
already current.

### Phase 2: Find your own pane

You need to send keys to the pane you are sitting in. Look yourself up:

```
mcp__plugin_crew_crew__agent_list()
```

Find the entry whose `id` matches your agent ID (from CLAUDE.md or identity.md).
Note its `pane` field. If `pane` is null, you're headless — recycle cannot
proceed, since there's no screen to send keys to. Report and stop.

### Phase 3: Send clear + boot

Send the two commands to your own pane. The current response must finish
before the CLI reads them, so they queue naturally behind this tool call:

```
mcp__plugin_crew_crew__pane_send(
  pane: "<your-pane>",
  text: "/clear\r"
)
```

Then:

```
mcp__plugin_crew_crew__pane_send(
  pane: "<your-pane>",
  text: "/knowledge:boot\r"
)
```

### Phase 4: Exit cleanly

After sending, end your response. Do not add more tool calls — the CLI needs
to process the queued input. The next thing you'll see is the boot output in
your fresh context.

## Design notes

- **Why this is safe**: save writes everything durable to the vault before
  clear runs. Boot reads the vault. The context window is the only thing
  that gets erased, and the context window is the thing you wanted to shed.
- **Why pane_send, not agent_send**: agent_send targets by screen session
  name. pane_send targets by pane. The pane is the stable handle — you know
  which pane you're in.
- **Why not /exit + relaunch**: same process is cheaper and preserves the
  pane, the attached session, and the terminal state. Exit-and-relaunch is
  handoff territory.
- **Failure mode**: if boot fails to restore context, you'll notice on the
  next turn. The vault is still intact; re-running `/knowledge:boot`
  manually is always an option.
