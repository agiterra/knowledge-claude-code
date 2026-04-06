---
description: Search the knowledge vault by keyword. Returns ranked results with scores, summaries, and matched keywords.
allowed-tools: Bash, Read, Task
argument-hint: "<query>"
---

# Search Knowledge Vault

**Scripts path**: The Python scripts live in the `knowledge-tools` plugin. Resolve the path with:
```
KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1)
```

Search the semantic index built by `/knowledge:index`. Finds memory files by
keyword overlap between your query and each file's indexed keywords and summary.

## Quick Search (human-readable output)

For simple lookups where keyword matching is sufficient:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/index-vault.py search '$ARGUMENTS'")
```

Results are ranked by relevance score:
- Full keyword match = 1.0 points
- Summary term match = 0.5 points
- Top 10 results shown

## Expanded Search (recommended for non-trivial queries)

For better recall, use a Haiku subagent to expand the query into synonyms
and related terms before searching. This catches files that use different
vocabulary for the same concepts.

1. Spawn a Haiku subagent to expand the query:

```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="Expand this search query into additional search terms.
    Query: '<query>'
    Generate 10-20 single-word synonyms, related terms, and alternate
    phrasings that someone might use when writing about this topic.
    Include: technical synonyms, informal equivalents, abbreviations,
    and closely related concepts.
    Return ONLY a comma-separated list of terms, nothing else.
    Example: for 'voice drift detection' you might return:
    tone,style,register,accent,shift,change,deviation,degradation,erosion,
    monitor,track,measure,signal,marker,indicator,fingerprint,linguistic"
)
```

2. Use the expanded terms in the search:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/index-vault.py search '$ARGUMENTS' --expand '<haiku-output>'")
```

Expanded terms match at reduced weight (0.6x for keywords, 0.3x for summary)
so they boost recall without overwhelming exact matches.

## Deep Search with Haiku Reranking

For complex or ambiguous queries, add a reranking step after expansion.
This is the highest-recall search mode — use it when you really need to
find something.

1. Get expanded terms (step 1 above)
2. Get structured candidates with expansion:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/index-vault.py search-json '$ARGUMENTS' --expand '<terms>'")
```

3. Spawn a Haiku subagent to rerank:

```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="Given the search query '<query>' and these candidate results:
    <paste search-json output>
    Score each candidate 0-10 for semantic relevance to the query.
    Consider: Does the summary suggest the file actually answers the query?
    Could the file contain useful context even if keywords don't match exactly?
    Return results sorted by your score, format:
    SCORE: <0-10> | PATH: <path> | REASON: <why relevant>"
)
```

4. Deep-read the top-scored files.

## Logging Misses

If a search didn't surface a file you expected, log it for evaluation:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/index-vault.py miss 'query terms' 'expected/file/path.md' 'optional reason'")
```

Review the miss log to improve keywords:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/index-vault.py misses")
```

## Journal Search

The vault index covers archival memory (markdown files). The journal covers
the change log — why beliefs exist, decisions made, corrections received.

If your vault search doesn't find what you need, or if you're looking for the
*reasoning behind* a belief rather than the belief itself, search the journal:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py search '$ARGUMENTS'")
```

To look up a specific provenance reference (`[j:42]` in identity.md):

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge-tools/*/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py get 42")
```

## Tips

- Use quick search for simple lookups (`identity drift`, `slack webhook`)
- Use expanded search for anything conceptual (`how does voice change over time`)
- Use deep search (expansion + reranking) when you really need to find something
- Use journal search for WHY questions (`why do we avoid blocking?`)
- If no results, the index may need updating — run `/knowledge:index scan`
- After finding candidates, deep-read the top results
- Log misses — they help you improve keyword coverage over time

## Deeper Search

For semantic similarity search (beyond keyword matching), use `/knowledge:enrich`.
This runs vector embedding search alongside keyword search and optionally
filters results through a Sonnet relevance judgment.

Requires: sentence-transformers (`pip install sentence-transformers`)
Optional: ANTHROPIC_API_KEY (for Sonnet filtering)

`$ARGUMENTS` is passed as the search query.
