/**
 * UserPromptSubmit hook: inject associative memory context.
 *
 * Reads the user prompt from stdin (Claude Code hook JSON), runs association
 * search against the knowledge vault, and outputs brief context for injection.
 *
 * Designed to be fast (<500ms). If search fails or returns nothing, outputs
 * nothing (empty stdout = no context injection).
 *
 * WHEN IT FIRES (Brioche ruling 2026-10-02 21:47Z, Wire 653413): only on a human prompt or a Wire
 * heartbeat. UserPromptSubmit also fires for every Wire channel event and every background-task
 * notification; each of those carried ~870 chars of associations into the context for good
 * (Baguette #76: 20 fires = 17k chars of 293k growth). Those prompts now get nothing.
 * HOW MUCH: the whole output is capped at MAX_CHARS (300).
 * SLACK (Tim 2026-10-13 16:55Z, via Brioche 712365): human prompts arrive from Slack too. A topic="slack"
 * channel event fires when its event is from a human (client_msg_id present, no bot_id), and the search
 * runs on event.text ONLY. The whole body would match on headers, tokens and blocks. Bot posts and CI
 * cards stay out.
 *
 * Stdin: {"prompt": "...", "session_id": "...", "cwd": "...", ...}
 * Stdout: plain text context (added to Claude's view) or nothing
 */

import { searchAssociations } from "@agiterra/knowledge-tools";

export const MAX_CHARS = 300;

const MIN_QUERY = 10;

/** event.text of a Slack channel body when a human wrote it; null for a bot post, a CI card or an unparseable body. */
export function humanSlackText(body: string): string | null {
  let ev: { client_msg_id?: unknown; bot_id?: unknown; text?: unknown } | undefined;
  try {
    ev = JSON.parse(body)?.payload?.event;
  } catch {
    return null;
  }
  if (!ev || !ev.client_msg_id || ev.bot_id) return null;
  return typeof ev.text === "string" && ev.text.trim() ? ev.text.trim() : null;
}

/**
 * The text to search, or null when this prompt gets no associations.
 * Human prompt or Wire heartbeat: the whole prompt. Human Slack message: its event.text only.
 * Any other channel event or a task notification: null.
 */
export function associationQuery(prompt: string): string | null {
  if (!prompt || prompt.length < MIN_QUERY) return null;
  if (prompt.includes("<task-notification>")) return null;
  const tags = prompt.match(/<channel\b[^>]*>/g);
  if (!tags) return prompt;
  if (tags.some((t) => /\btopic="heartbeat"/.test(t))) return prompt;
  const texts: string[] = [];
  for (const m of prompt.matchAll(/<channel\b[^>]*\btopic="slack"[^>]*>([\s\S]*?)<\/channel>/g)) {
    const t = humanSlackText(m[1].trim());
    if (t) texts.push(t);
  }
  const q = texts.join("\n");
  return q.length >= MIN_QUERY ? q : null;
}

/** True for a human prompt, a Wire heartbeat or a human Slack message; false for any other channel event or a task notification. */
export function shouldAssociate(prompt: string): boolean {
  return associationQuery(prompt) !== null;
}

/** Header plus as many lines as fit, the whole block <= max chars (newlines included). Empty when no line fits. */
export function capBlock(header: string, lines: string[], max = MAX_CHARS): string {
  let out = header;
  let n = 0;
  for (const l of lines) {
    if (out.length + 1 + l.length > max) break;
    out += "\n" + l;
    n++;
  }
  return n > 0 ? out : "";
}

async function main() {
  let hookInput: { prompt?: string };
  try {
    const raw = await Bun.stdin.text();
    hookInput = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const query = associationQuery(hookInput.prompt ?? "");
  if (query === null) process.exit(0);

  try {
    const result = await searchAssociations(query, { topK: 8, vectorLimit: 5 });
    const assocs = result.results;
    if (assocs.length === 0) process.exit(0);

    const lines: string[] = [];
    const seen = new Set<string>();

    for (const a of assocs.slice(0, 5)) {
      if (seen.has(a.source)) continue;
      seen.add(a.source);
      if (a.score < 0.1) continue;

      const summary = a.summary.slice(0, 80);
      const tag = a.search_method === "vector" ? "vec" : "kw";
      const score = a.score.toFixed(2);
      lines.push(`[${tag} ${score}] ${a.source}: ${summary}`);
    }

    const block = capBlock(`[Associations (${Math.round(result.timing_ms)}ms)]`, lines);
    if (block) console.log(block);
  } catch (e) {
    console.error(`[assoc-hook] error: ${e}`);
  }

  process.exit(0);
}

if (import.meta.main) main();
