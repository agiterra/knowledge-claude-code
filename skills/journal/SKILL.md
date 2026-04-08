---
description: Write to and query the knowledge vault journal — the log of WHY beliefs exist. Records context behind identity changes, learnings, corrections, and decisions.
allowed-tools: Bash, Read
argument-hint: "<subcommand> [args]"
---

# Journal — The Change Log

**Scripts path**: The Python scripts live in the `knowledge-tools` plugin. Resolve the path with:
```
KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1)
```

The journal is the append-only record of WHY things are the way they are.

For **persistent agents**, the journal records learnings, corrections, and
decisions that shaped identity (defined in CLAUDE.md) and vault knowledge.

For **project repos**, the journal records why conventions were adopted,
architectural decisions, and rationale behind project knowledge. Any agent
working in the repo can query the journal before changing a convention to
understand the reasoning behind it.

**Before modifying CLAUDE.md or any vault knowledge, search the journal first.**
The journal may contain context about why something was written the way it was.

## Subcommands

### Initialize (first time only)

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py init")
```

### Add an Entry

When you learn something, make a decision, get corrected, or have a significant
conversation — journal it.

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py add '<category>' '<summary>' '<context>' --source '<who/what>' --tags '<comma,separated>'")
```

Categories: `learning`, `correction`, `decision`, `experiment`, `conversation`

- **summary**: One line — what happened
- **context**: The full WHY — reasoning chain, what was considered, what was
  rejected, what led to this. This is the most important field. Be thorough.
- **source**: Who or what prompted this (e.g., "Tim DM", "self-reflection",
  "Andy feedback", "experiment results")
- **tags**: Comma-separated keywords for filtering

After adding, note the `j:N` ID. If this entry should be referenced from
CLAUDE.md or a vault knowledge file, add the reference: `[j:N]`.

### Vector Update

After adding a journal entry, if vector embeddings are available, update:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/vectorize.py update --journal $ID")
```

### Search the Journal

Before changing core beliefs, search for prior context:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py search '<query>'")
```

Uses SQLite FTS5 full-text search across summary, context, and tags.

### Look Up a Specific Entry

When CLAUDE.md or a vault file references `[j:42]`, retrieve the full context:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py get 42")
```

### Recent Entries

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py recent 10")
```

### Filter by Category or Tag

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py by-category correction")
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py by-tag identity")
```

### Provenance Check (before modifying CLAUDE.md or vault knowledge)

If CLAUDE.md or a vault file says `- Never block the main thread [j:3, j:7, j:19]`,
read all referenced entries before changing or removing that rule:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py get 3")
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py get 7")
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py get 19")
```

### Stats

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py stats")
```

## When to Journal

- **After a correction**: Someone told you something was wrong. Record what was
  wrong, why, and what the fix was. Category: `correction`
- **After a decision**: You chose between options. Record what you chose, what
  the alternatives were, and why. Category: `decision`
- **After learning something new**: A pattern, a principle, a technique.
  Category: `learning`
- **After a significant conversation**: The conversation shaped your thinking.
  Category: `conversation`
- **After an experiment**: You tried something and it worked or didn't.
  Category: `experiment`

## The Provenance Chain

CLAUDE.md and vault knowledge files reference journal entries:
```
- Never block the main thread [j:3, j:7, j:19]
- Adopted exhaustive switch pattern [j:45]
```

Each rule becomes traceable — grounded in the experiences and decisions
that produced it. A rule without journal references is an assertion. A rule
with references is knowledge.

### Backup (safe dump)

**Always use `backup` instead of `dump` for routine SQL export.**

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py backup")
```

`backup` dumps to a temp file, verifies the INSERT count and in-memory
rebuild match the live DB, then atomically replaces `journal.sql`. This
prevents the footgun where shell redirects with `dump` overwrite good data.

**Never** do `journal.py dump > journal.sql` — `dump` writes to the file
directly AND prints status to stdout, so the redirect captures only the
status line and overwrites the real dump.

### Rebuild

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py rebuild")
```

Rebuild validates the SQL file has entries before deleting the existing DB.
If the SQL is empty, rebuild refuses (pass `--force` to override). The
existing DB is backed up to `.bak` before deletion.

## Git Strategy

- `journal.db` is .gitignored (binary)
- `journal.sql` (text dump) lives in git
- Use `backup` (not `dump`) to update the SQL file safely
- On fresh clone, run `journal.py rebuild` to recreate the db from the dump
- The boot sequence handles this automatically

`$ARGUMENTS` is passed as the subcommand and arguments.
