/**
 * UserPromptSubmit hook: enrich inbound channel (IPC) messages with deeper
 * vault context than the baseline association hook provides.
 *
 * Why a separate hook: the association-hook runs on every UserPromptSubmit
 * and injects a compact 5-line association summary. That's enough for most
 * operator prompts, but not for the use-case where agent A spawns agent B
 * and sends B a task via IPC — B needs the relevant project files / feedback
 * memos, not just one-line summaries. Croissant missing the framing on
 * Brioche's OAK#3 task (2026-04-14) was this failure mode.
 *
 * Design constraints:
 * - Receiver-side only. Enrichment lands in the receiver's context, not the
 *   sender's (avoids double-polluting two windows with the same content).
 * - Opt-in via the KNOWLEDGE_ENRICH_RULES env var, a JSON allowlist keyed by
 *   channel topic. Opaque to crew — crew just forwarded the env string.
 * - Pattern-matches on the <channel ...> prompt format Claude Code uses
 *   when injecting channel notifications. No import of wire-tools.
 *
 * Env var schema (KNOWLEDGE_ENRICH_RULES):
 *   {
 *     "<topic>": {
 *       "from": ["<sender-agent-id>", ...]  // optional; if omitted, all senders match
 *     },
 *     ...
 *   }
 *
 * Example — Brioche enriching Danish's IPC:
 *   env.KNOWLEDGE_ENRICH_RULES = '{"ipc":{"from":["brioche"]}}'
 *
 * Stdin: {"prompt": "...", "session_id": "...", "cwd": "...", ...}
 * Stdout: bracketed enrichment block (added to Claude's view) or nothing.
 */

import { searchAssociations } from "@agiterra/knowledge-tools";

type Rules = Record<string, { from?: string[] }>;

/** Extract first attribute value from a tag string. */
function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m?.[1];
}

/** Parse KNOWLEDGE_ENRICH_RULES from env. Returns {} on any failure. */
function parseRules(): Rules {
  const raw = process.env.KNOWLEDGE_ENRICH_RULES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Rules;
  } catch (e) {
    console.error(`[channel-enrich] bad KNOWLEDGE_ENRICH_RULES JSON: ${e}`);
    return {};
  }
}

/** Decide whether a (topic, from) pair matches the configured rules. */
function matches(rules: Rules, topic: string, from: string): boolean {
  const rule = rules[topic];
  if (!rule) return false;
  if (!rule.from || rule.from.length === 0) return true;
  return rule.from.includes(from);
}

async function main() {
  let input: { prompt?: string };
  try {
    input = JSON.parse(await Bun.stdin.text());
  } catch {
    process.exit(0);
  }

  const prompt = input.prompt ?? "";
  if (!prompt.includes("<channel ")) process.exit(0); // not a channel message

  const rules = parseRules();
  if (Object.keys(rules).length === 0) process.exit(0); // no rules configured

  // Extract the opening <channel ...> tag. CC injects channel notifications
  // as XML; we only need the attributes.
  const tagMatch = prompt.match(/<channel\b[^>]*>/);
  if (!tagMatch) process.exit(0);
  const tag = tagMatch[0];

  const topic = attr(tag, "topic");
  // Channel XML has two `source` attributes (plugin source + sender); prefer
  // `user` which is unambiguously the sender agent id.
  const from = attr(tag, "user");
  if (!topic || !from) process.exit(0);

  if (!matches(rules, topic, from)) process.exit(0);

  // Extract payload text. Body between <channel ...> and </channel> is the
  // JSON payload. Pull payload.text for search; fall back to the whole body.
  const bodyMatch = prompt.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/);
  const body = bodyMatch?.[1]?.trim() ?? "";
  let queryText = body;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      const nested = (parsed as Record<string, unknown>).payload;
      const inner = (nested && typeof nested === "object" ? nested : parsed) as Record<string, unknown>;
      if (typeof inner.text === "string") queryText = inner.text;
    }
  } catch {
    // body wasn't JSON — keep the raw body as the query
  }

  if (!queryText || queryText.length < 10) process.exit(0);

  try {
    const result = await searchAssociations(queryText, {
      topK: 15,
      vaultLimit: 15,
      vectorLimit: 10,
      journalLimit: 15,
    });
    const assocs = result.results;
    if (assocs.length === 0) {
      // "No matches" and "hook didn't fire" look identical from the agent's
      // perspective — surface the no-match path on stderr so they're
      // distinguishable in CC hook traces.
      console.error(`[channel-enrich] 0 associations for topic=${topic} from=${from} (query: ${queryText.slice(0, 80)})`);
      process.exit(0);
    }

    const lines: string[] = [];
    const seen = new Set<string>();

    for (const a of assocs.slice(0, 12)) {
      if (seen.has(a.source)) continue;
      seen.add(a.source);
      if (a.score < 0.1) continue;
      const summary = a.summary.slice(0, 140);
      const tag = a.search_method === "vector" ? "vec" : "kw";
      const score = a.score.toFixed(2);
      lines.push(`  [${tag} ${score}] ${a.source}: ${summary}`);
    }

    if (lines.length > 0) {
      const elapsed = Math.round(result.timing_ms);
      console.log(`[Channel Enrichment — from ${from}, topic=${topic} (${elapsed}ms)]`);
      console.log(lines.join("\n"));
    }
  } catch (e) {
    console.error(`[channel-enrich] error: ${e}`);
  }

  process.exit(0);
}

main();
