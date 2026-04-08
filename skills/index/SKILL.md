---
description: Build or update the semantic index of the knowledge vault. Scans for changed files and prints them for indexing.
allowed-tools: Bash, Read, Task
argument-hint: "[scan|file <path>|update <path> <summary> <keywords>|stats]"
---

# Index Knowledge Vault

**Scripts path**: The Python scripts live in the `knowledge-tools` plugin. Resolve the path with:
```
KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1)
```

Build a keyword-based semantic index of all markdown files in `.knowledge/`.
The index enables fast search across the vault without loading every file.

**IMPORTANT: Use a Haiku subagent for summary/keyword generation.** This is
commodity work — don't burn Opus tokens on it. Spawn a Task with
`model="haiku"` to read each file and produce the summary + keywords.

## Quick Start (full reindex)

1. Scan for files that need indexing:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/index-vault.py scan")
```

2. For each `NEEDS_INDEX` file, spawn a Haiku subagent to generate summary + keywords:

```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="Read the file at .knowledge/path/to/note.md. Generate:
    1. A one-line semantic summary
    2. 10-25 keywords following these rules:
       - Include concrete terms (names, tools, specific concepts)
       - Include abstract themes (patterns, categories)
       - Include SYNONYMS for key concepts (e.g., 'voice' -> also 'tone,style,register')
       - Include abbreviations and alternate phrasings
       - More keywords = better search recall, so err on the side of more
    3. Related file paths from the vault (if any)
    Format your response as:
    SUMMARY: <summary>
    KEYWORDS: <comma-separated keywords>
    RELATED: <comma-separated paths or 'none'>"
)
```

3. Use the Haiku output to update the index:

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/index-vault.py update .knowledge/path/to/note.md 'summary from haiku' 'keywords,from,haiku' 'related/paths.md'")
```

4. Repeat for each file that needs indexing.

## Commands

- **scan** — Find files needing indexing. Compares content hashes to detect changes.
- **file `<path>`** — Print a file's content and hash for you to summarize.
- **update `<path>` `<summary>` `<keywords-csv>` `[related-csv]`** — Write an index entry.
- **stats** — Show index statistics (file counts, keyword counts, stale entries).

## Index Location

The index is stored at `.knowledge/meta/semantic-index.json`. Each entry contains:
- `source_path` — path to the markdown file
- `content_hash` — short SHA-256 hash for change detection
- `summary` — one-line semantic summary (Haiku generates this)
- `keywords` — list of searchable keywords (Haiku generates these)
- `related` — optional list of related file paths

## Guidelines for Haiku Keyword Generation

Include these in the prompt to the Haiku subagent:
- Include 10-25 keywords per file (more = better recall)
- Mix concrete terms (names, tools, concepts) with abstract themes
- **Include synonyms** — for every key concept, add 2-3 alternate terms a
  searcher might use. This is the single highest-impact thing for search quality.
- Include abbreviations and informal equivalents
- For identity/meta files, include the agent's name and role

If `$ARGUMENTS` is provided, pass it as the command (e.g., `/knowledge:index scan`).
