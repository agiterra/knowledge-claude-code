---
description: Lightweight keyword-only association search — fast (<100ms), no vector embeddings, no LLM. Returns quick context associations from the knowledge vault.
allowed-tools: Bash, Read
argument-hint: "<text>"
---

# Associate — Fast Keyword Associations

**Scripts path**: The Python scripts live in the `knowledge-tools` plugin. Resolve the path with:
```
KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1)
```

Run a lightweight keyword-only association search against the knowledge vault.
Unlike `/knowledge:enrich`, this is fast (<100ms) and requires no vector
embeddings or LLM calls.

## Usage

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/association-search.py \"$ARGUMENTS\" --no-vector")
```

Results are returned as concise context lines showing matched files with
relevance indicators.

## When to Use This

Run this when you want quick associations from your knowledge vault — a fast
scan of what's related to a concept or phrase. Good for:

- Checking what you already know about a topic before writing
- Finding related files to read before making a decision
- Quick context gathering during conversation

For deeper semantic search with vector similarity and LLM filtering, use
`/knowledge:enrich` instead.

`$ARGUMENTS` is passed as the text to find associations for.
