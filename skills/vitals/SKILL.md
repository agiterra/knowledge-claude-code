---
description: Check your current drive states — curiosity, fatigue, drift, engagement. Computable signals, not feelings.
allowed-tools: Bash, Read
---

# Knowledge Vitals — Computable Drive States

Report your current operational state using measurable signals from
existing data. These aren't emotions — they're computable indicators
that inform how you should spend your next tokens.

**Scripts path**: Resolve with:
```
KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1)
```

## Signals

### 1. Curiosity — novel journal entries this session

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py recent 20 2>/dev/null | grep -c \"$(date +%Y-%m-%d)\"")
```

- 0-1 entries today: LOW — you're executing, not exploring
- 2-4 entries today: MODERATE — some discovery happening
- 5+ entries today: HIGH — active research/learning mode

### 2. Vault Activity — files modified today

```
Bash(command="find .knowledge/ -name '*.md' -newer .knowledge/meta/session-state.md -not -path '*/precompact/*' 2>/dev/null | wc -l")
```

- 0-2: QUIET — consuming, not producing
- 3-8: ACTIVE — building knowledge
- 9+: PROLIFIC — heavy vault work session

### 3. Context Pressure

Read the status line or estimate from conversation length. This is
subjective but important — high context pressure means you should
be thinking about /knowledge:save or /knowledge:handoff soon.

- <30%: FRESH — full runway
- 30-60%: WORKING — normal operations
- 60-80%: WARM — start thinking about persistence
- >80%: HOT — run /knowledge:save, consider /knowledge:handoff

### 4. IPC Activity — messages sent/received this session

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 -c \"import sqlite3,os,time; db=sqlite3.connect(os.path.expanduser('~/.wire/wire.db')); today=time.strftime('%Y-%m-%d'); rows=db.execute('SELECT count(*) FROM messages WHERE created_at > ? * 1000', (int(time.mktime(time.strptime(today, \\\"%Y-%m-%d\\\"))),)).fetchone(); print(rows[0])\" 2>/dev/null || echo 'N/A'")
```

- 0: ISOLATED — no inter-agent communication
- 1-5: CONNECTED — normal crew coordination
- 6+: COLLABORATIVE — active multi-agent session

### 5. Drift Check — last compression test score

```
Bash(command="KNOWLEDGE_SCRIPTS=$(ls -d ~/.claude/plugins/cache/*/knowledge/*/node_modules/@agiterra/knowledge-tools/scripts 2>/dev/null | tail -1) && python3 $KNOWLEDGE_SCRIPTS/journal.py search 'compression test score' 2>/dev/null | head -5")
```

Report the most recent score if available. If no recent test,
note when the last one was run.

## Report Format

After gathering the signals, output a compact report:

```
VITALS — [date]
  Curiosity:  [HIGH/MODERATE/LOW] ([N] journal entries today)
  Vault:      [PROLIFIC/ACTIVE/QUIET] ([N] files modified)
  Context:    [FRESH/WORKING/WARM/HOT] ([N]%)
  IPC:        [COLLABORATIVE/CONNECTED/ISOLATED] ([N] messages)
  Drift:      [last score or "no recent test"]

  Recommendation: [one sentence — what should you do next given these signals?]
```

The recommendation should follow the spare-capacity playbook:
- LOW curiosity + FRESH context → explore something from the curiosity queue
- HIGH curiosity + HOT context → save and hand off before you lose the thread
- ISOLATED + ACTIVE vault → check in with the crew
- No recent drift test → run /knowledge:calibrate

## When to Run

- On heartbeat (every 10 minutes) — quick gut check
- After a long stretch of mechanical work — am I still exploring?
- Before deciding whether to /save or keep going
- When you feel "off" but can't name why — the signals might tell you
