---
description: Initialize a knowledge vault. Creates .knowledge directory, config, and session state template.
argument-hint: [project-name]
allowed-tools: Bash, Read, Write
---

# Initialize Knowledge Vault

Set up the directory structure for a new knowledge vault.

1. Create the .knowledge directory and subdirectories:

```
Bash(command="mkdir -p .knowledge/meta .knowledge/meta/precompact")
```

2. Create config.json:

```
Write(file_path=".knowledge/config.json", content="{\n  \"version\": 1,\n  \"vault\": \".knowledge\",\n  \"created\": \"$DATE\"\n}\n")
```

Replace `$DATE` with today's date in ISO format.

3. Create structured session state:

```
Write(file_path=".knowledge/meta/session-state.md", content="# Session State\n\nLast updated: [date]\n\n## Active Work\n- [What you're currently doing, with enough detail to resume]\n- [File paths, line numbers, specific state]\n\n## Pending Tasks\n- Review CLAUDE.md and customize for this project\n\n## Key References\n- [IDs, paths, URLs, credentials locations, specific values needed for work]\n\n## Corrections & Mechanisms\n- [Format: CORRECT ANSWER: X. WRONG ANSWER: Y. MECHANISM: why X not Y.]\n- [This triple format survives compaction better than facts alone.]\n\n## Watermark\n- [Last processed event/message timestamp, if applicable]\n- [Update after every response or conscious skip]\n\n## History\n- [Move completed work here. Session-state is for ACTIVE work only.]\n- [Completed tasks that stay in Active Work crowd out identity during compaction.]\n")
```

4. Create .env if it doesn't exist:

```
Write(file_path=".env", content="# Credentials — not committed\n# Add environment variables your agent needs here\n")
```

5. Initialize .knowledge as a separate git repo (keeps vault private):

```
Bash(command="cd .knowledge && git init && git add -A && git commit -m 'Initial vault'")
```

6. Tell the user:
   - Edit CLAUDE.md to define the agent's mission, voice, autonomy, and values
   - Edit `.knowledge/meta/session-state.md` after each session (or during — assume interruption!)
   - Add to the project's CLAUDE.md: "After context compaction, run /knowledge:boot"
   - The PreCompact hook is already wired — it will back up transcripts and extract
     recovery hints before each compaction automatically

If `$ARGUMENTS` is provided, use it as the project name in config.json.
