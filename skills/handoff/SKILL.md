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

Launch the twin with a `-twin` suffix as the **crew ID** (screen session handle).
The twin inherits your **Wire identity** from the project directory's env config
— same `WIRE_AGENT_ID`, same signing keys. So it posts as you on Wire while
crew can still tell the sessions apart.

```
mcp__plugin_crew_crew__agent_launch(
  id: "<agent-id>-twin",
  name: "<Agent Name> Twin",
  project_dir: "<current working directory>",
  prompt: "Run /knowledge:boot to restore your context. Once booted, wait for instructions — you may receive a quiz via your screen session to verify boot fidelity."
)
```

Replace `<agent-id>`, `<Agent Name>`, and `<current working directory>` with
the actual values from your identity and environment.

### Phase 3: Wait for Boot

Monitor the twin's progress:
1. Wait ~30 seconds for boot to complete
2. Use `mcp__plugin_crew_crew__agent_read(id: "<agent-id>-twin")` to check screen output
3. Boot is complete when you see the twin's status summary or idle prompt

### Phase 4: Send Quiz

Send the questions directly to the twin's screen session:

```
mcp__plugin_crew_crew__agent_send(
  id: "<agent-id>-twin",
  text: "Quick continuity check before you take over. Answer briefly:\n1. What were you working on before this boot?\n2. <your other questions>"
)
```

Then read the response:
```
mcp__plugin_crew_crew__agent_read(id: "<agent-id>-twin")
```

This uses the screen session directly — no IPC needed since both instances
share the same agent identity.

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
2. Send a confirmation to the twin's screen:
   ```
   mcp__plugin_crew_crew__agent_send(
     id: "<agent-id>-twin",
     text: "You passed the continuity check. You're the primary instance now. Active threads: <include current active threads>"
   )
   ```
3. Journal the handoff result

### Phase 7: Pane Takeover

The twin takes over the outgoing agent's pane. Two paths depending on environment:

**Screen mode** (outgoing agent was launched via `agent_launch` / is in a screen session):

1. The outgoing agent should have registered its pane during boot.
2. Attach the twin to the outgoing agent's registered pane:
   ```
   mcp__plugin_crew_crew__agent_attach(id: "<agent-id>-twin", pane: "<agent-id>")
   ```
3. Stop the outgoing agent's crew session:
   ```
   mcp__plugin_crew_crew__agent_stop(id: "<agent-id>")
   ```
4. Optionally rename the twin to reclaim the original crew ID (if `agent_rename`
   is available):
   ```
   mcp__plugin_crew_crew__agent_rename(id: "<agent-id>-twin", new_id: "<agent-id>")
   ```

**Pane mode** (outgoing agent is a bare CLI session, not in screen):

1. Create a pane and attach the twin below the outgoing agent:
   ```
   mcp__plugin_crew_crew__pane_create(tab: "handoff", name: "<agent-id>-twin", position: "below")
   mcp__plugin_crew_crew__agent_attach(id: "<agent-id>-twin", pane: "<agent-id>-twin")
   ```
2. The outgoing agent exits itself (the twin is already visible and running).

**If failed:**
1. Stop the twin: `mcp__plugin_crew_crew__agent_stop(id: "<agent-id>-twin")`
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

- The twin uses `<agent-id>-twin` as its **crew ID** (screen session handle) but
  inherits the same **Wire identity** from the project directory's env config.
  Crew can disambiguate; Wire sees one agent. After handoff, `agent_rename`
  (when available) lets the twin reclaim the original crew ID.
- The twin boots from vault files only — same CLAUDE.md, session-state.md, conventions.md
- Enrichment (association search, vector search) is available to the twin during the quiz
- The quiz tests task continuity, not identity (identity comes from CLAUDE.md)
- Epistemic honesty > completeness. Flagging "I don't know" beats confabulating.
- This is NOT a Turing test. The twin doesn't need to fool anyone. It needs to
  continue your work without losing context.
- Two takeover paths: screen mode (seamless pane swap) and bare CLI mode (split + exit fallback).
  Screen mode is preferred — launch agents via crew's `agent_launch` to enable it.
  Pane mode is the fallback when the outgoing agent wasn't launched via crew.
- The outgoing instance's last act is exiting. It doesn't need to wait for confirmation —
  the twin is already verified and running.
- Quiz uses screen read/send, not IPC — both instances share the same Wire identity,
  so IPC would be talking to yourself. Crew IDs are distinct (`herald` vs `herald-twin`).
