import { describe, expect, test } from "bun:test";
import { MAX_CHARS, capBlock, shouldAssociate } from "./association-hook";

const chan = (topic: string, body = '{"text":"hello there from an agent"}') =>
  `<channel source="plugin:wire:wire" chat_id="wire:brioche" message_id="1" user="brioche" ts="t" seq="1" source="brioche" topic="${topic}" created_at="1">\n${body}\n</channel>`;

describe("shouldAssociate", () => {
  test("human prompt fires", () => expect(shouldAssociate("Run the boot and then check the lanes")).toBe(true));
  test("heartbeat channel event fires", () => expect(shouldAssociate(chan("heartbeat", '{"type":"heartbeat","prompt":"weekly grooming"}'))).toBe(true));
  test("ipc channel event does not fire", () => expect(shouldAssociate(chan("ipc"))).toBe(false));
  test("webhook channel event does not fire", () => expect(shouldAssociate(chan("hive"))).toBe(false));
  test("several channel events, none a heartbeat, do not fire", () => expect(shouldAssociate(chan("ipc") + "\n" + chan("hive"))).toBe(false));
  test("a heartbeat among channel events fires", () => expect(shouldAssociate(chan("ipc") + "\n" + chan("heartbeat"))).toBe(true));
  test("task notification does not fire", () =>
    expect(shouldAssociate("<task-notification>\n<task-id>x</task-id>\n<status>completed</status>\n</task-notification>")).toBe(false));
  test("short prompt does not fire", () => expect(shouldAssociate("ok")).toBe(false));
  test("a human prompt that mentions the word topic fires", () => expect(shouldAssociate('what does topic="ipc" mean here')).toBe(true));
});

describe("capBlock", () => {
  const line = (i: number) => `[kw 1.00] journal:${i}: ` + "x".repeat(80);
  test("never exceeds the cap", () => {
    const out = capBlock("[Associations (12ms)]", [1, 2, 3, 4, 5].map(line));
    expect(out.length).toBeLessThanOrEqual(MAX_CHARS);
    expect(out.split("\n").length).toBeGreaterThan(1);
  });
  test("keeps whole lines only", () => {
    const out = capBlock("[Associations (12ms)]", [1, 2, 3, 4, 5].map(line));
    for (const l of out.split("\n").slice(1)) expect(l).toMatch(/x{80}$/);
  });
  test("empty when no line fits", () => expect(capBlock("H", ["y".repeat(400)])).toBe(""));
  test("all lines when they fit", () => expect(capBlock("H", ["a", "b"])).toBe("H\na\nb"));
});
