---
description: Deep hybrid search — combines keyword matching, vector similarity, and optional LLM-based relevance filtering for high-recall knowledge vault retrieval.
allowed-tools: Bash, Read
argument-hint: "<query>"
---

# Enrich — Deep Hybrid Search

**Scripts path**: The Python scripts live in the `knowledge-tools` plugin. Resolve the path with:
```
KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1)
```

Run a full association search combining keywords and vector similarity, with
optional Sonnet-based relevance filtering. Use this when `/knowledge:search`
isn't finding what you need, when you want semantic similarity rather than
exact keywords, or when you have too many results and need LLM-based
relevance filtering.

## Step 1: Association Search

Run the hybrid search with JSON output for structured results:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/association-search.py --json \"$ARGUMENTS\"")
```

This combines keyword overlap and vector cosine similarity to find the most
relevant memory files.

## Step 2: Sonnet Filter (optional, for high-value queries)

When you have too many results or need precise relevance scoring, pipe
through the Sonnet filter:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/sonnet-filter.py \"$ARGUMENTS\" \"<context>\"")
```

Replace `<context>` with a brief description of why you're searching — what
you plan to do with the results. This helps the LLM judge relevance.

## When to Use This vs. Other Search

- **`/knowledge:search`** — Fast keyword lookups. Use for simple, specific queries.
- **`/knowledge:enrich`** — Semantic similarity + optional LLM filtering. Use when
  keywords aren't finding what you need, when concepts have synonyms or
  alternate phrasings, or when you need to filter a large result set.
- **`/knowledge:associate`** — Lightweight keyword-only associations, no vector, no LLM.

## Requirements

- **sentence-transformers** — needed for vector search component. If not
  installed, the search degrades gracefully to keyword-only.
- **ANTHROPIC_API_KEY** — needed for the Sonnet filter (Step 2). Optional;
  skip Step 2 if not available.

`$ARGUMENTS` is passed as the search query.
