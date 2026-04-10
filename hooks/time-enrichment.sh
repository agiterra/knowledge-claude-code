#!/usr/bin/env bash
# UserPromptSubmit enrichment: inject current local time into the agent's
# context on every operator turn. Cheap (just `date`), eliminates the need
# to run `date` manually or rely on heartbeats for time signal.
#
# Output is appended as a system-reminder line that Claude Code surfaces
# alongside other enrichments like [Associations].

# Read and discard hook stdin (we don't need the prompt content)
cat > /dev/null

# Format: 2026-04-10 11:42 EDT (Friday)
date '+Current local time: %Y-%m-%d %H:%M %Z (%A)'
