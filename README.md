# knowledge-claude-code

Knowledge vault runtime — journal, search, enrichment, and compaction recovery for `.knowledge/` directories.

## Prerequisites

- Python 3.10+ (required for vector and index scripts)
- Bun (https://bun.sh)

## Install

```
/plugin install agiterra/knowledge-claude-code
```

## Tools / Skills

**Skills:**
- `knowledge:boot` — full boot sequence, restores session state after context compaction
- `knowledge:save` — persist session state and journal a summary before exit
- `knowledge:init` — initialize a new `.knowledge/` vault in the current project
- `knowledge:scan` — scan vault file headers to build a mental index
- `knowledge:search` — keyword search across the vault
- `knowledge:enrich` — deep hybrid search (keyword + vector + optional LLM filtering)
- `knowledge:journal` — write to and query the journal (the log of why beliefs exist)
- `knowledge:vectorize` — build/update vector embeddings for semantic search
- `knowledge:index` — build or update the semantic index
- `knowledge:calibrate` — measure decompression fidelity after compaction
- `knowledge:fork` — spawn a warm research fork, returns a distilled brief
- `knowledge:handoff` — spawn a fresh agent, quiz it, hand off primary status if it passes
- `knowledge:vitals` — check current drive states (curiosity, fatigue, drift, engagement)
- `knowledge:associate` — fast keyword-only association search (no embeddings, <100ms)

## Configuration

No required env vars. The vault defaults to `.knowledge/` in the current working directory. Override with `KNOWLEDGE_DIR` if needed.
