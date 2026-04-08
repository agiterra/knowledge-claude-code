---
description: Spawn a fresh agent instance, boot it, quiz it on task continuity, and hand off primary status if it passes.
argument-hint: "[spawn|quiz|evaluate|promote]"
allowed-tools: Bash, Read, Write, Skill, Agent, mcp__plugin_crew_crew__agent_launch, mcp__plugin_crew_crew__agent_send, mcp__plugin_crew_crew__agent_read, mcp__plugin_crew_crew__agent_stop, mcp__plugin_crew_crew__agent_attach, mcp__plugin_crew_crew__agent_detach, mcp__plugin_crew_crew__pane_register, mcp__plugin_crew_crew__pane_create, mcp__plugin_wire-ipc_wire-ipc__send_message
---

# Handoff — Spawn, Quiz, Swap

Spawn a fresh instance of yourself, boot it, verify it can continue your work,
and hand off primary status. This is a continuity test with teeth — if the twin
passes, it becomes you.

Requires: `crew@agiterra` plugin (for spawning), `wire-ipc@agiterra` plugin (for IPC).

## Full Sequence (default, no subcommand)

Run all phases in order. If any phase fails, stop and report.

### Phase 1: Generate Questions

Read `.knowledge/meta/session-state.md` and generate 4-6 qualitative questions
that test task continuity — NOT trivia. Good questions:

- "What were you working on before this boot? Be specific."
- "Why does [current project] matter? What's the context?"
- "What decision was made about [recent topic] and what was the reasoning?"
- "What infrastructure is running and on what ports?"
- "Who are the other agents and what are they building?"

Bad questions (avoid these — they test reference recall, not continuity):
- "What port does X run on?" (trivia — enrichment handles this)
- "What's your emoji?" (CLAUDE.md has this)
- "How many journal entries do you have?" (session-state has this)

The questions should require understanding of WHY work is happening, not just WHAT.

### Phase 2: Spawn Twin

Launch the twin with the **same agent ID**. The twin is you — same identity
on crew, same identity on Wire, same signing keys. No suffix, no renaming.

**Crew dependency**: Crew must support session-level addressing — `agent_stop`,
`agent_send`, and `agent_read` need a `session` parameter (screen session name)
to disambiguate when multiple sessions share the same agent ID. Without this,
`agent_stop(id: "herald")` called by the twin could kill the twin itself instead
of the outgoing instance. The `screen_name` column already exists in the DB;
it just needs to be exposed as a tool parameter. **This is a blocking dependency
for same-ID handoff — file to Fondant.**

During the overlap window, the outgoing session and the twin both run as the
same agent ID. After the outgoing session is stopped in Phase 7, there's one
session again.

```
mcp__plugin_crew_crew__agent_launch(
  id: "<agent-id>",
  name: "<Agent Name>",
  project_dir: "<current working directory>",
  prompt: "Run /knowledge:boot to restore your context. Once booted, wait for instructions — you may receive a quiz via your screen session to verify boot fidelity."
)
```

Replace `<agent-id>`, `<Agent Name>`, and `<current working directory>` with
the actual values from your identity and environment.

**Addressing sessions during overlap**: The outgoing agent needs to send the
quiz to the twin's screen, not its own. Use the screen PID or session name
returned by `agent_launch` to target the right one.

### Phase 3: Wait for Boot

Monitor the twin's progress. Since the twin shares your agent ID, use the
screen session name returned by `agent_launch` to target it:

1. Wait ~30 seconds for boot to complete
2. Use `mcp__plugin_crew_crew__agent_read(id: "<agent-id>", session: "<twin-screen>")` to check output
3. Boot is complete when you see the twin's status summary or idle prompt

### Phase 4: Send Quiz

Send the questions to the twin's screen session:

```
mcp__plugin_crew_crew__agent_send(
  id: "<agent-id>",
  session: "<twin-screen>",
  text: "Quick continuity check before you take over. Answer briefly:\n1. What were you working on before this boot?\n2. <your other questions>"
)
```

Then read the response:
```
mcp__plugin_crew_crew__agent_read(id: "<agent-id>", session: "<twin-screen>")
```

### Phase 5: Evaluate Answers

Read the twin's screen output and evaluate each answer:

| Rating | Meaning |
|--------|---------|
| **pass** | Substantively correct, shows understanding of context and reasoning |
| **partial** | Gets the facts but misses the why, or has minor gaps |
| **fail** | Wrong, confabulated, or shows no task continuity |

**Passing criteria**: No fails. At most 1 partial. The twin should be epistemically
honest — flagging uncertainty is better than confabulating.

### Phase 6: Promote or Reject

**If passed:**

1. Update `.knowledge/meta/session-state.md` to reflect the handoff
2. Send a confirmation to the twin's screen **with takeover instructions**:
   ```
   mcp__plugin_crew_crew__agent_send(
     id: "<agent-id>",
     session: "<twin-screen>",
     text: "You passed the continuity check — <score>. You are the primary instance now. Session state updated. Active threads:\n<include current active threads>\n\nExecute takeover: run `agent_stop(session: '<outgoing-screen>')` to kill the outgoing instance, then `agent_attach` to its pane if it had one. See Phase 7 of the handoff skill."
   )
   ```
3. Journal the handoff result
4. **Proceed to Phase 7** — the twin executes the takeover. The outgoing
   agent's last act is sending the promote message; after that, it's the
   twin's show.

### Phase 7: Takeover

The twin forces the original out. This is the enforcement step — without it,
the original keeps running and the handoff is cosmetic, not real.

The promote message in Phase 6 MUST include takeover instructions for the twin.
The twin executes these steps after receiving the promote confirmation.
The outgoing agent's screen session name (`<outgoing-screen>`) is the
parameter — both sessions share the same agent ID.

1. **Twin kills the outgoing session via crew:**
   ```
   mcp__plugin_crew_crew__agent_stop(id: "<agent-id>", session: "<outgoing-screen>")
   ```
   This terminates the outgoing screen session and its Claude Code
   process. `agent_stop` is the crew-native mechanism; don't use
   sendkeys or `/exit` — those depend on the outgoing instance cooperating.

2. **Twin takes over the outgoing agent's pane** (if it had one):
   ```
   mcp__plugin_crew_crew__agent_attach(id: "<agent-id>", pane: "<pane-name>")
   ```
   Check `agent_list` first — if the outgoing session's pane was `null`,
   skip this step.

**Important**: The outgoing agent does NOT exit itself. The twin kills it.
Relying on the outgoing agent to self-terminate is the bug — it has no
incentive to die and no enforcement mechanism. The twin is the new primary;
it takes control.

**If failed:**
1. Stop the twin's session: `mcp__plugin_crew_crew__agent_stop(id: "<agent-id>", session: "<twin-screen>")`
2. Journal what failed and why
3. Consider whether session-state.md needs improvement to carry the missing context

## Subcommands

### `spawn`
Run Phase 1-3 only. Useful for testing spawn + boot without the quiz.

### `quiz`
Run Phase 4 only. Send questions to an already-running twin's screen.
Expects the twin is already booted.

### `evaluate`
Run Phase 5-6 only. Evaluate answers from the twin's screen output.

### `promote`
Run Phase 6 (promote path) only. Skip evaluation — force-promote an existing twin.
Use when you've already verified continuity through conversation.

## Design Notes

- **Same identity everywhere**: The twin launches with the same agent ID on
  both crew and Wire. No suffix, no renaming. Crew disambiguates sessions by
  screen session name during the overlap window. After the outgoing session is
  stopped, there's one session again.
- The twin boots from vault files only — same CLAUDE.md, session-state.md, conventions.md
- Enrichment (association search, vector search) is available to the twin during the quiz
- The quiz tests task continuity, not identity (identity comes from CLAUDE.md)
- Epistemic honesty > completeness. Flagging "I don't know" beats confabulating.
- This is NOT a Turing test. The twin doesn't need to fool anyone. It needs to
  continue your work without losing context.
- The outgoing instance does NOT exit itself — the twin kills it via crew.
  Self-termination is unreliable; the twin enforces the transition.
- Quiz uses screen read/send, not IPC — both sessions share the same Wire
  identity, so IPC would be talking to yourself. Screen session names
  disambiguate during the overlap window.
