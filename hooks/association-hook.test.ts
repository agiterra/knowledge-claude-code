import { describe, expect, test } from "bun:test";
import { MAX_CHARS, associationQuery, capBlock, shouldAssociate } from "./association-hook";

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

// Shapes copied from real webhook.slack bodies (fondant transcripts, 2026-10-02 and 2026-10-13).
const slackBody = (event: Record<string, unknown>) =>
  JSON.stringify({
    source: "mivid-studios", topic: "webhook.slack", plugin: "slack",
    headers: { "user-agent": "Slackbot 1.0", "x-slack-request-timestamp": "1790963347" },
    payload: { token: "TOKENSHOULDNOTMATCH", team_id: "T011EBY6RUN", event },
  });
const human = { type: "message", user: "U011EBY6S6A", client_msg_id: "B28AFA57", channel_type: "im",
  text: "Perhaps per-page subscriptions make more sense",
  blocks: [{ type: "rich_text", elements: [{ type: "text", text: "Perhaps per-page subscriptions make more sense" }] }] };
const bot = { type: "message", user: "U0BV4998PQ9", bot_id: "B0BV61J7UJG", app_id: "A0BV5RW4WJG", text: "Understood. I wrote the first glossary." };
const ciCard = { type: "message", subtype: "bot_message", bot_id: "B0CI", text: "CI failed on develop: build 1234" };

describe("Slack (Tim 2026-10-13)", () => {
  test("a human Slack DM fires", () => expect(shouldAssociate(chan("slack", slackBody(human)))).toBe(true));
  test("the query is event.text only, not headers, token or blocks", () =>
    expect(associationQuery(chan("slack", slackBody(human)))).toBe("Perhaps per-page subscriptions make more sense"));
  test("a bot post does not fire", () => expect(shouldAssociate(chan("slack", slackBody(bot)))).toBe(false));
  test("a CI card does not fire", () => expect(shouldAssociate(chan("slack", slackBody(ciCard)))).toBe(false));
  test("client_msg_id together with bot_id does not fire", () =>
    expect(shouldAssociate(chan("slack", slackBody({ ...human, bot_id: "B1" })))).toBe(false));
  test("a system message (no client_msg_id, no bot_id) does not fire", () =>
    expect(shouldAssociate(chan("slack", slackBody({ type: "message", subtype: "channel_join", user: "U1", text: "<@U1> has joined the channel" })))).toBe(false));
  test("an unparseable Slack body does not fire", () => expect(shouldAssociate(chan("slack", "{not json"))).toBe(false));
  test("a human Slack DM with too short a text does not fire", () =>
    expect(shouldAssociate(chan("slack", slackBody({ ...human, text: "ok" })))).toBe(false));
  test("a human Slack DM among IPC events fires on the Slack text only", () =>
    expect(associationQuery(chan("ipc") + "\n" + chan("slack", slackBody(human)))).toBe("Perhaps per-page subscriptions make more sense"));
  test("the client_msg_id test reads the event, not a string anywhere in an IPC body", () =>
    expect(shouldAssociate(chan("ipc", slackBody(human)))).toBe(false));
  test("a human prompt is still searched whole", () =>
    expect(associationQuery("Run the boot and then check the lanes")).toBe("Run the boot and then check the lanes"));
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
