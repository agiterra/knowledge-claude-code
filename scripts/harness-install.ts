#!/usr/bin/env bun
/**
 * harness-install.ts — make this plugin's hooks run under Codex and Grok.
 *
 *   bun scripts/harness-install.ts codex [--cwd DIR] [--dry-run]
 *   bun scripts/harness-install.ts grok  [--grok-home DIR] [--dry-run]
 *   bun scripts/harness-install.ts --selftest
 *
 * Run it from the INSTALLED copy of the plugin: the plugin root is this file's parent directory.
 *
 * Why each harness needs a step (measured 2026-09-28, codex-cli 0.156 via codex-acp 1.13; grok 1.0.30):
 * - Claude Code: nothing. Plugin skills and hooks load as-is (also under claude-agent-acp).
 * - Codex: hooks.json is read unchanged and CLAUDE_PLUGIN_ROOT is set, but every hook is SILENTLY
 *   SKIPPED until trusted (trustStatus untrusted/modified). `--dangerously-bypass-hook-trust` exists
 *   only on exec/tui; codex-acp spawns plain `codex app-server`. So we persist trust the way the TUI's
 *   hook review does: app-server hooks/list, then config/batchWrite
 *   hooks.state."<key>".trusted_hash = currentHash. A plugin update changes the hash (status
 *   "modified"), so re-run this after every update. Codex does not run postInstall, so node_modules
 *   (knowledge-tools) is installed here too.
 * - Grok: skills load, but hooks inside a plugin never fire (the plugin reports has_hooks=true, hook
 *   discovery registers 0, via --plugin-dir and via ~/.grok/plugins alike). Hook files in
 *   $GROK_HOME/hooks/*.json DO fire, so we write hooks.json there with the plugin root made absolute.
 *   Known loss: Grok discards an allowing UserPromptSubmit hook's stdout, so association/time context
 *   cannot reach the model from a hook (grok user guide, 10-hooks.md).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const PLUGIN_NAME = "knowledge";

function die(msg: string, code = 1): never { console.error(`harness-install: ${msg}`); process.exit(code); }

// ── Grok ──────────────────────────────────────────────────────────────────────

/** hooks.json with the plugin root made absolute and Claude-only fields Grok does not take removed. */
export function materializeGrokHooks(hooksJson: string, root: string): { hooks: Record<string, unknown[]> } {
  const text = hooksJson.replaceAll("${CLAUDE_PLUGIN_ROOT}", root).replaceAll("$CLAUDE_PLUGIN_ROOT", root);
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed.hooks !== "object") throw new Error("hooks.json has no top-level 'hooks' object");
  for (const groups of Object.values(parsed.hooks) as any[][]) {
    for (const g of groups) for (const h of g.hooks ?? []) delete h.async;
  }
  if (text.includes("CLAUDE_PLUGIN_ROOT")) throw new Error("an unexpanded CLAUDE_PLUGIN_ROOT reference remains");
  return parsed;
}

function installGrok(grokHome: string, dryRun: boolean) {
  const src = join(ROOT, "hooks", "hooks.json");
  const out = materializeGrokHooks(readFileSync(src, "utf8"), ROOT);
  const dest = join(grokHome, "hooks", `${PLUGIN_NAME}.json`);
  const events = Object.keys(out.hooks).sort().join(", ");
  if (dryRun) { console.log(`dry-run: would write ${dest} (${events}) from ${src}`); return; }
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(out, null, 2) + "\n");
  renameSync(tmp, dest);
  const back = JSON.parse(readFileSync(dest, "utf8"));
  if (JSON.stringify(back) !== JSON.stringify(out)) die(`readback of ${dest} does not match what was written`);
  console.log(`grok: wrote ${dest} (${events}); plugin root ${ROOT}`);
}

// ── Codex ─────────────────────────────────────────────────────────────────────

function ensureDeps(dryRun: boolean) {
  if (existsSync(join(ROOT, "node_modules", "@agiterra", "knowledge-tools"))) return;
  if (dryRun) { console.log(`dry-run: would run bun install in ${ROOT}`); return; }
  const r = spawnSync("bun", ["install", "--frozen-lockfile"], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) die(`bun install failed in ${ROOT} (exit ${r.status})`);
}

async function withAppServer<T>(fn: (rpc: (m: string, p: unknown) => Promise<any>) => Promise<T>): Promise<T> {
  const cs = spawn(process.env.CODEX_PATH ?? "codex", ["app-server"], { stdio: ["pipe", "pipe", "inherit"] });
  const pending = new Map<number, (m: any) => void>(); let id = 0; let buf = "";
  const exited = new Promise<never>((_, rej) => cs.on("exit", (c) => rej(new Error(`codex app-server exited (${c})`))));
  cs.stdout.on("data", (d) => {
    buf += d; let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      let m: any; try { m = JSON.parse(line); } catch { continue; }
      if (m.id !== undefined && !m.method) { pending.get(m.id)?.(m); pending.delete(m.id); }
    }
  });
  const rpc = (method: string, params: unknown) => Promise.race([exited, new Promise<any>((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result));
    cs.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: i, method, params }) + "\n");
  })]);
  try {
    await rpc("initialize", { clientInfo: { name: "knowledge-harness-install", title: "knowledge harness install", version: "1" } });
    cs.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "initialized" }) + "\n");
    return await fn(rpc);
  } finally { cs.kill(); }
}

const ours = (h: any) => typeof h.pluginId === "string" && h.pluginId.startsWith(`${PLUGIN_NAME}@`);

async function installCodex(cwd: string, dryRun: boolean) {
  ensureDeps(dryRun);
  await withAppServer(async (rpc) => {
    const list = async () => ((await rpc("hooks/list", { cwds: [cwd] })).data ?? []).flatMap((e: any) => e.hooks ?? []);
    const mine = (await list()).filter(ours);
    if (mine.length === 0) die(`no ${PLUGIN_NAME}@* hooks visible to Codex for cwd ${cwd} — is the plugin installed and enabled? (codex plugin list)`);
    const todo = mine.filter((h: any) => h.trustStatus === "untrusted" || h.trustStatus === "modified");
    console.log(`codex: ${mine.length} ${PLUGIN_NAME} hooks, ${todo.length} need trust (${[...new Set(mine.map((h: any) => h.pluginId))].join(", ")})`);
    if (todo.length === 0) return;
    if (dryRun) { for (const h of todo) console.log(`dry-run: would trust ${h.key} (${h.trustStatus})`); return; }
    const edits = todo.map((h: any) => ({ keyPath: `hooks.state.${JSON.stringify(h.key)}.trusted_hash`, mergeStrategy: "upsert", value: h.currentHash }));
    await rpc("config/batchWrite", { edits, reloadUserConfig: true });
    const after = (await list()).filter(ours);
    const still = after.filter((h: any) => h.trustStatus !== "trusted" && h.trustStatus !== "managed");
    if (still.length) die(`still untrusted after write: ${still.map((h: any) => `${h.key}=${h.trustStatus}`).join(", ")}`);
    console.log(`codex: trusted ${todo.length}; readback ${after.length}/${after.length} trusted`);
  });
}

// ── Selftest ──────────────────────────────────────────────────────────────────

function selftest() {
  let fail = 0;
  const ck = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) fail++; };
  const sample = JSON.stringify({ hooks: {
    Stop: [{ matcher: "", hooks: [{ type: "command", command: "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/x.sh\"", timeout: 15 }] }],
    PreCompact: [{ matcher: "", hooks: [{ type: "command", command: "bash $CLAUDE_PLUGIN_ROOT/hooks/p.sh", async: true }] }],
  } });
  const out = materializeGrokHooks(sample, "/opt/k");
  const s = JSON.stringify(out);
  ck("braced root expanded", s.includes('bash \\"/opt/k/hooks/x.sh\\"'));
  ck("bare root expanded", s.includes("bash /opt/k/hooks/p.sh"));
  ck("async removed", !s.includes("async"));
  ck("timeout kept", (out.hooks.Stop[0] as any).hooks[0].timeout === 15);
  let threw = false; try { materializeGrokHooks("{}", "/x"); } catch { threw = true; }
  ck("rejects a file without hooks", threw);
  threw = false;
  try { materializeGrokHooks(JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "x ${CLAUDE_PLUGIN_ROOT:-/y}" }] }] } }), "/opt/k"); } catch { threw = true; }
  ck("refuses a root reference it cannot expand", threw);
  // The real hooks.json must materialize with no leftover references and every event intact.
  const real = readFileSync(join(ROOT, "hooks", "hooks.json"), "utf8");
  const rm = materializeGrokHooks(real, ROOT);
  ck("real hooks.json: events preserved", JSON.stringify(Object.keys(rm.hooks).sort()) === JSON.stringify(Object.keys(JSON.parse(real).hooks).sort()));
  ck("real hooks.json: every command points into the plugin root", (Object.values(rm.hooks) as any[][]).flat().flatMap((g: any) => g.hooks).filter((h: any) => h.command.includes("/hooks/")).every((h: any) => h.command.includes(ROOT)));
  // End to end into a temp GROK_HOME, including the atomic write + readback path.
  const t = mkdtempSync(join(tmpdir(), "kh-selftest-"));
  try {
    installGrok(t, false);
    ck("grok install wrote hooks/knowledge.json", existsSync(join(t, "hooks", "knowledge.json")));
    ck("no temp file left behind", !existsSync(join(t, "hooks", `knowledge.json.tmp-${process.pid}`)));
  } finally { rmSync(t, { recursive: true, force: true }); }
  console.log(fail ? `${fail} FAILED` : "all passed");
  process.exit(fail ? 1 : 0);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = args.includes("--dry-run");
if (args[0] === "--selftest") selftest();
else if (args[0] === "grok") installGrok(resolve(flag("--grok-home") ?? process.env.GROK_HOME ?? join(homedir(), ".grok")), dryRun);
else if (args[0] === "codex") await installCodex(resolve(flag("--cwd") ?? process.cwd()), dryRun).catch((e) => die(String(e?.stack ?? e)));
else die("usage: harness-install.ts codex [--cwd DIR] [--dry-run] | grok [--grok-home DIR] [--dry-run] | --selftest", 64);
