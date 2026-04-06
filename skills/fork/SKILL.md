---
description: Spawn a warm fork of yourself to research a question. The fork has your session context, full vault access, and returns a distilled brief. Your context stays clean.
argument-hint: "<research task>"
allowed-tools: Bash, Read, Agent, Skill
---

# Knowledge Fork — Delegated Cognition

Spawn a subagent that knows what you're working on and has full vault access.
It researches the question, makes editorial judgments about relevance, and
returns a brief. You never see the noise — only the insight.

This is NOT a search tool. Enrich finds files. Fork *thinks* about what
the files mean for your current work.

## When to Use

- Deep research that would crowd your context window
- Questions that require reading 5+ vault files to answer
- "Does X connect to Y?" where the connection requires synthesis
- Background investigation while you keep working on something else

## How It Works

1. Read `.knowledge/meta/session-state.md` to get current work context
2. Build a fork prompt combining session context + the research task
3. Spawn a background agent (Sonnet by default — save Opus for the editorial judgment YOU make about the results)
4. The fork reads vault files, journal entries, and does the research
5. Returns a brief: what it found, what it means, what you should do

## Execute

```
Read(file_path=".knowledge/meta/session-state.md")
```

Then spawn the fork:

```
Agent(
  description="Fork: <short task description>",
  model="sonnet",
  run_in_background=true,
  prompt="You are a research fork of a persistent agent. You have the same
vault and journal access as the parent, but your job is to research a
specific question and return a distilled brief — NOT a list of files,
but an editorial judgment about what matters and why.

## Your Parent's Current Context

<paste session-state.md content here>

## Your Research Task

$ARGUMENTS

## Instructions

1. Read relevant vault files in .knowledge/ (use Glob and Read)
2. Search the journal: python3 <scripts>/journal.py search '<query>'
3. Think about what the findings mean for the parent's current work
4. Return a brief (max 500 words):
   - FINDING: What you discovered (cite vault files and journal entries)
   - IMPLICATION: What it means for the parent's current work
   - RECOMMENDATION: What the parent should do with this information
   - SOURCES: File paths and j:N references

Be editorial, not exhaustive. The parent doesn't want everything you
read — they want the 3 things that change how they think about the problem."
)
```

## Important

- **Use Sonnet for the fork** unless the research requires deep reasoning.
  Sonnet is fast and cheap. You (Opus) are the editorial layer — you decide
  what to do with the brief.
- **Run in background** when possible. The fork works while you keep going.
- **The brief replaces the reading, not supplements it.** If you read the
  brief and then also read all the source files, you've defeated the purpose.
  Trust the fork's editorial judgment. Pull a source file only if something
  in the brief surprises you.
- **Session state is the warm context.** It's not a full conversation fork
  (that requires a Claude Code feature that doesn't exist yet). But it knows
  what you're working on, what's pending, and what matters — enough for good
  editorial decisions.
- **The fork is disposable.** It exists to answer one question. Don't try to
  maintain state across forks.
