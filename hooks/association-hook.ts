/**
 * UserPromptSubmit hook: inject associative memory context.
 *
 * Reads the user prompt from stdin (Claude Code hook JSON), runs association
 * search against the knowledge vault, and outputs brief context for injection.
 *
 * Operator prompts only: channel-delivered messages (IPC / webhook firehoses)
 * are skipped here — enriching them is the opt-in channel-enrichment hook's job.
 *
 * Designed to be fast (<500ms). If search fails or returns nothing, outputs
 * nothing (empty stdout = no context injection).
 *
 * Stdin: {"prompt": "...", "session_id": "...", "cwd": "...", ...}
 * Stdout: plain text context (added to Claude's view) or nothing
 */

import { searchAssociations } from "@agiterra/knowledge-tools";

async function main() {
  let hookInput: { prompt?: string };
  try {
    const raw = await Bun.stdin.text();
    hookInput = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const prompt = hookInput.prompt ?? "";
  if (!prompt || prompt.length < 10) process.exit(0);

  // Channel-delivered messages (IPC, and github/slack webhook firehoses) are the
  // channel-enrichment hook's job — opt-in per topic via KNOWLEDGE_ENRICH_RULES.
  // This baseline hook is for OPERATOR prompts; running a vault search over a
  // ~30KB webhook payload on every event is a fleet-wide token sink that rarely
  // surfaces anything relevant (Brioche/Tim, 2026-06-15). Skip them here — the
  // useful operator-prompt associations and opt-in channel enrichment both stay.
  if (prompt.includes("<channel ")) process.exit(0);

  try {
    const result = await searchAssociations(prompt, { topK: 8, vectorLimit: 5 });
    const assocs = result.results;
    if (assocs.length === 0) process.exit(0);

    const lines: string[] = [];
    const seen = new Set<string>();

    for (const a of assocs.slice(0, 5)) {
      if (seen.has(a.source)) continue;
      seen.add(a.source);
      if (a.score < 0.1) continue;

      const summary = a.summary.slice(0, 120);
      const tag = a.search_method === "vector" ? "vec" : "kw";
      const score = a.score.toFixed(2);
      lines.push(`  [${tag} ${score}] ${a.source}: ${summary}`);
    }

    if (lines.length > 0) {
      const elapsed = Math.round(result.timing_ms);
      console.log(`[Associations (${elapsed}ms)]`);
      console.log(lines.join("\n"));
    }
  } catch (e) {
    console.error(`[assoc-hook] error: ${e}`);
  }

  process.exit(0);
}

main();
