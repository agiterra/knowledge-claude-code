# Knowledge — Vault Runtime (Claude Code)

This is the Claude Code adapter for the knowledge vault system. It wires
knowledge-tools scripts into Claude Code's hook and skill system.

After context compaction, run /knowledge:boot to restore continuity.

## Skills

- `/knowledge:boot` — Restore vault state after compaction
- `/knowledge:init` — Set up a new .knowledge/ vault
- `/knowledge:scan` — Scan vault file headers (build mental index)
- `/knowledge:index` — Build/maintain semantic keyword index
- `/knowledge:search` — Search vault by keywords
- `/knowledge:associate` — Fast keyword-only associations
- `/knowledge:enrich` — Deep hybrid search (keyword + vector + LLM filter)
- `/knowledge:journal` — Append-only log of WHY beliefs exist
- `/knowledge:calibrate` — Measure compaction fidelity
- `/knowledge:vectorize` — Build vector embeddings
- `/knowledge:save` — Deliberate session preservation before exit
- `/knowledge:fork` — Spawn a warm research fork with session context
- `/knowledge:handoff` — Self-compaction: save, spawn fresh, verify, swap

## Hooks

- **UserPromptSubmit** — Injects relevant vault context on each prompt
- **PreCompact** — Backs up transcript and recovery data
- **SessionStart** — Reminds agent to boot after compaction
- **SessionEnd** — Auto-commits vault changes as safety net

## Memory Discipline

**Persist before promising.** When the operator corrects you, confirms a
non-obvious choice, or states a preference — write it to the vault in the
same turn. Do not say "got it" or "I'll remember" without a file write.
Sessions end, context compacts, and unpersisted promises vanish.

Triggers to watch for:
- Operator corrections: "no, not that", "don't do X", "stop doing Y"
- Operator confirmations of non-obvious choices: "yes, exactly", "perfect"
- Stated preferences: "I prefer X", "always do Y", "never do Z"

**Promote patterns to identity.** A single correction is a vault file. A
correction the operator has given before is a value — add it to CLAUDE.md.
CLAUDE.md is read on every session start; vault files require search to
surface. Instructions get skimmed; values get followed.

**The pipeline:** operator feedback → vault file (immediate) → CLAUDE.md (if
it's a recurring pattern). The plugin teaches the pipeline; each agent's
CLAUDE.md carries the conviction.

## Two Contexts

The knowledge plugin serves two contexts:

### Agent vaults (persistent agents like Brioche, Herald, Fondant)
- CLAUDE.md in the project root defines identity
- Journal records personal learnings, corrections, decisions
- Session-state tracks continuity across compactions
- Boot restores state after compaction
- Save preserves state before exit

### Project knowledge bases (repos like fabrica-v3)
- No identity — CLAUDE.md defines project rules, not agent personality
- Journal records project decisions: why conventions were adopted,
  architectural rationale, context behind rules
- Session-state is per-worktree (ephemeral agents write theirs there)
- Enrichment gives all agents access to project knowledge
- Any agent can query the journal before changing a convention

No config flag distinguishes the two — the vault structure is the same.
The difference is in what content lives there and who writes to it.

## Vault Architecture

The knowledge vault lives at `.knowledge/` in the project root (override
with `KNOWLEDGE_VAULT` env var or `--vault` CLI arg on scripts).

### Structure
- `config.json` — vault-specific settings (extra_dirs, etc.)
- `meta/semantic-index.json` — keyword index for search
- `meta/precompact/` — recovery data from context compaction
- `journal.db` — SQLite journal (binary, .gitignored)
- `journal.sql` — text dump of journal (in git)
- `vectors.db` — vector embeddings (binary, .gitignored)
- All other `.md` files — knowledge entries

### Key Principles
- **Schema-agnostic** — the plugin doesn't enforce entry format. Each
  project's CLAUDE.md defines its own conventions.
- **Retrieval over curation** — vault grows unboundedly. Discovery is via
  enrichment (keyword + vector + association), not manual browsing.
- **Two enrichment chances** — passive (UserPromptSubmit hook) and explicit
  (manual /knowledge:search or /knowledge:enrich). Use both before
  reporting yourself stuck.
