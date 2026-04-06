---
description: Scan knowledge vault file headers to build a mental index. Reads the first 3 lines of each markdown file in .knowledge/ without loading full content.
allowed-tools: Bash, Read
---

# Memory Scan

Build a table of contents of the knowledge vault by reading file headers.

Convention: memory files should have:
- **Line 1**: `# Title`
- **Line 3**: `#tags #for #searching`

Run this scan:

```
Bash(command="for dir in .knowledge/*/; do echo \"=== $dir ===\"; for f in \"$dir\"*.md; do [ -f \"$f\" ] && head -3 \"$f\" && echo; done; done")
```

Read the output to understand what's available in memory. Do NOT deep-read files unless you need their content for the current task. The scan gives you enough context to know where to look.

If `$ARGUMENTS` contains a search term, also run:

```
Bash(command="grep -rl '$ARGUMENTS' .knowledge/ --include='*.md'")
```

to find files mentioning that term.
