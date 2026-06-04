# knowledge

> Persistent memory for your AI agent. A vault of markdown files, an append-only journal, and search that survives context compaction.

Part of the [Agiterra Multi-Agent Toolkit](https://github.com/agiterra/handbook).

## What this gets you

- **Your agent remembers across sessions.** Not just notes — a structured vault with an editorial index, a journal of *why* things are the way they are, and search across all of it.
- **Compaction is no longer a memory wipe.** When Claude Code compacts context, your agent runs `/knowledge:boot` and is back where they left off.
- **Pair with [knowledge-indexer](https://github.com/agiterra/knowledge-indexer-claude-code)** for auto-indexing on every vault write — semantic + keyword search runs in milliseconds.

## Quick setup

If you have a Claude Code agent open, say:

> "Install the Agiterra knowledge plugin and initialize a vault for me."

Or manually:

```
/plugin marketplace add agiterra/claude-marketplace   # one-time
/plugin install knowledge@agiterra
```

Then in any project: `/knowledge:init` to scaffold a `.knowledge/` directory.

### Prerequisites
- Python 3.10+ (vector + index scripts)
- Bun (https://bun.sh)

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

## Concepts

- [Knowledge vaults — agent vault vs project vault](https://github.com/agiterra/handbook/blob/main/CORE.md#3-knowledge-vaults)
- [Where knowledge belongs — orchestrator's decision tree](https://github.com/agiterra/handbook/blob/main/PROJECTS.md#knowledge-placement-decision-tree)

## Vault vs. journal — the discipline that keeps memory honest

The plugin gives your agent two memory stores with different jobs:

- **The vault** (`.knowledge/*.md`) — your agent's *current* beliefs, rules, identity, and learnings. This is what gets searched and **auto-injected into context** on every user prompt and every configured Wire event. It answers *"what do I know right now?"*
- **The journal** (`journal.db`, via `knowledge:journal`) — an append-only log of *why* those beliefs exist: the context behind each rule, correction, and decision. The journal is **deliberately not part of prompt enrichment** — never auto-searched or injected. It answers *"why is it this way?"*

The vault holds the rule; the journal holds the intent behind it. So one discipline is worth hard-coding into how your agent works:

> **Before you change a rule, read its journal.** When you're about to rewrite or drop a rule in the vault, first query the journal (`knowledge:journal`) for why it was set. Then either **preserve the original intent** — adjust the rule without discarding what it was protecting — or **knowingly reject that intent**, journaling why the old reason no longer holds. Never overwrite a hard-won rule blind: the vault tells you the rule, but only the journal remembers what it cost to learn.

## Configuration

No required env vars. The vault defaults to `.knowledge/` in the current working directory. Override with `KNOWLEDGE_DIR` if needed.

### Auto-memory bridge (`KNOWLEDGE_AUTO_MEMORY_BRIDGE`)

Claude Code ships with built-in auto-memory at `~/.claude/projects/<slug>/memory/`. Its `MEMORY.md` is injected into context at session start (up to ~200 lines), and the system prompt instructs Claude to write learnings there. Without coordination this competes with `.knowledge/` for the same writes — operator preferences drift, journal stays sparse, CC-only memory becomes silently load-bearing.

The `auto-memory-bridge` SessionStart hook makes auto-memory a **derived view of the vault**:

- Reads the most recent journal entries, current `session-state.md` Active Work, and any hand-written feedback/user/project/reference files
- Regenerates `MEMORY.md` as an index pointing at the vault as canonical
- Hand-written individual memory files (`feedback_*.md`, `user_*.md`, etc.) are preserved and indexed by their frontmatter `description`
- If `MEMORY.md` doesn't have the `AUTO-GENERATED` marker, the hook treats it as user-managed and leaves it alone

Opt out per-session: `KNOWLEDGE_AUTO_MEMORY_BRIDGE=0`

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
