---
description: Mechanical vault persistence — journal.db → journal.sql, git add, commit, push. No editorial work. Safe to call from hooks, save-family skills, and periodic triggers.
allowed-tools: Bash
---

# Knowledge Checkpoint

One job: make the vault durable.

1. Back up `journal.db` → `journal.sql` (via `journal.py backup`, atomic).
2. `git add` the vault directory.
3. `git commit` if there are changes.
4. `git push` if `origin` is set.

Nothing else. No conversation scan, no session-state edit, no learning extraction. Those are the editorial steps — they belong in `/knowledge:save` and `/knowledge:fast-save`, which call this skill at the end.

## When to run

- At the end of `/knowledge:save` and `/knowledge:fast-save` (automatic)
- At the start of `/knowledge:recycle` (automatic — no editorial scan, just flush)
- From the `SessionEnd` hook (automatic)
- From the `PreCompact` hook (automatic)
- Directly as `/knowledge:checkpoint` when you want a periodic snapshot without editorial work

## Invocation

```
Bash(command="SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1); bash \"$SCRIPTS/checkpoint.sh\" --cwd . --message \"[optional commit message]\"")
```

Flags:
- `--cwd DIR` — project root containing the vault (defaults to `$PWD`)
- `--message MSG` — commit message (defaults to `Checkpoint vault (timestamp)`)
- `--no-push` — skip `git push` (useful from `PreCompact` if push latency matters)
- `--strict` — fail the script if `git push` fails (default: swallow push failures)

## Idempotent

Running checkpoint twice in a row is a noop on the second run. Safe to call liberally — `git commit` only fires if there are actual staged changes, and `git push` only fires if there's a commit ahead of origin.

## Not in scope

- Doesn't update `session-state.md` — that's editorial; use `/knowledge:fast-save` or `/knowledge:save`.
- Doesn't journal a session summary — that's editorial; use `/knowledge:save`.
- Doesn't run semantic index or vector update — those are maintenance; they run on a separate cadence.
