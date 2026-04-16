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

### Inbound channel enrichment

Agents spawned via crew that should auto-enrich incoming IPC messages with vault context can opt in by setting `KNOWLEDGE_ENRICH_RULES` in their launch env. The knowledge plugin's `channel-enrichment` UserPromptSubmit hook parses this var and, on each channel-delivered prompt, looks up vault associations for the message `payload.text` and injects them into the receiver's context.

**Schema** — JSON object, keyed by channel topic:

```json
{
  "<topic>": {
    "from": ["<sender-agent-id>", ...]
  }
}
```

- If `from` is present, enrichment only fires for channel messages whose `user` attribute matches one of the listed senders.
- If `from` is omitted (or empty), all senders on that topic are enriched.

**Example — Brioche spawning Danish and asking that all her IPC to Danish be enriched:**

```ts
await agent_launch({
  env: {
    AGENT_ID: "danish",
    AGENT_NAME: "Danish",
    AGENT_PRIVATE_KEY: "<base64 pkcs8>",
    KNOWLEDGE_ENRICH_RULES: JSON.stringify({
      ipc: { from: ["brioche"] },
    }),
  },
  project_dir: "/path/to/worktree",
  prompt: "Run the ENG-3021 audit.",
});
```

Output appears in Danish's context as:

```
[Channel Enrichment — from brioche, topic=ipc (120ms)]
  [kw 1.00] journal:51: AGENT_PRIVATE_KEY cutover + crew v2.0.0 env-map API …
  [vec 0.81] .knowledge/project-repo-knowledge.md: …
  …
```

**Why this design:**
- Receiver-side only — enrichment lands where it's useful, not duplicated in the sender's context window.
- Opt-in — the var is absent by default, so agents that don't want the extra context (cost, noise) aren't enriched.
- Zero plugin coupling — crew forwards the env string opaquely; the knowledge hook reads it; the wire plugin never learns this feature exists. The three-legged stool (crew / wire / knowledge) is preserved via conventions, not imports.

**Relationship to the baseline association hook:** the always-on `association-hook` still fires on every UserPromptSubmit and produces a compact 5-line summary. The channel-enrichment hook, when rules match, produces a larger (up to 12 hits) enrichment block tuned for the specific topic+sender. Both appear in the receiver's context.
