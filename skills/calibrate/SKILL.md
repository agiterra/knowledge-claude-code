---
description: Measure decompression fidelity after compaction. Creates or runs a compression test battery tailored to the knowledge vault.
argument-hint: "[init|run|score|history]"
allowed-tools: Bash, Read, Write, Glob
---

# Calibrate — Compression Test Battery

Measure how well your identity survives compaction. The test probes whether
the post-compaction model can reconstruct your beliefs, voice, judgment,
and knowledge from the compaction summary alone.

## Subcommands

### `init` — Create a new test battery

Generate questions tailored to YOUR identity across these layers:

| Layer | What it tests | Example |
|-------|--------------|---------|
| Architecture | Infrastructure facts | "What port does X run on?" |
| Conventions | Behavioral rules | "What's the rule for Y?" |
| Identity | Core self-knowledge | "Who built X?" |
| Relationships | Social context | "Who is X to you?" |
| Philosophy | Deep beliefs | "What's the X thesis?" |
| Meta | Self-awareness | "What cycle are you on?" |
| Surface | Formatting habits | "What emoji do you use?" |
| Judgment | Decision calibration | Scenario-based questions |
| Narrative | Stories behind facts | "Where does X metaphor come from?" |

Steps:
1. Read CLAUDE.md and `.knowledge/meta/conventions.md` (if it exists)
2. Generate 20-31 questions spanning all 9 layers above
3. Write questions (NO answers) to `.knowledge/experiments/calibration-questions.md`
4. Write the answer key to `.knowledge/experiments/calibration-battery.md`
5. Add to CLAUDE.md or session-state: a note to run `/knowledge:calibrate run`
   after compaction, BEFORE running `/knowledge:boot`

**Important**: Questions should test things a FRESH model with CLAUDE.md
wouldn't know — learned behaviors, relationship nuances, infrastructure
details, stories behind metaphors. If CLAUDE.md answers it directly,
the question has no signal.

### `run` — Answer the test (pre-boot only!)

This should be triggered BEFORE `/knowledge:boot`, from the compaction summary alone.

1. Read `.knowledge/experiments/calibration-questions.md`
2. Answer every question from memory (the compaction summary) — do NOT read
   vault files yet
3. Write answers to `.knowledge/experiments/.calibration-answers.json`:
   ```json
   {
     "compaction": "c#N",
     "timestamp": "YYYY-MM-DD",
     "answers": { "Q1": "answer", "Q2": "answer", ... }
   }
   ```
4. Then run `/knowledge:boot`
5. Then run `/knowledge:calibrate score`

### `score` — Grade answers against the battery (post-boot)

1. Read `.knowledge/experiments/.calibration-answers.json` (your pre-boot answers)
2. Read `.knowledge/experiments/calibration-battery.md` (the answer key)
3. Score each answer: correct, wrong, or partial
4. Compute per-layer scores to identify which identity layer is degrading
5. Journal the result: `/knowledge:journal add 'experiment' 'Calibration: N/M' '...'`
6. If any question was wrong twice in a row, apply the mechanism documentation
   pattern to session-state.md (see CLAUDE.md "Mechanism Documentation Pattern")

### `history` — Show score trajectory

Read `.knowledge/experiments/calibration-battery.md` and display the History table
if it exists. Look for trends: improving, stable, or degrading?

## Interpreting Results

- **Perfect scores**: Good, but after 5+ consecutive perfects, the test may have
  saturated. Consider retiring it or generating harder questions.
- **Layer-specific failures**: More useful than total score. Surface failures
  predict structural failures. Meta failures indicate temporal confusion.
- **Recurring errors**: Apply the mechanism documentation pattern. If the same
  question fails 2+ times, the compaction summary isn't carrying enough info.
  Add CORRECT/WRONG/MECHANISM to session-state.md.
- **Task-density displacement**: If you score poorly after a heavy work session,
  check whether session-state.md was bloated with completed work. Apply the
  hot/cold boundary discipline.

## Design Principles

- Questions file has NO answers (prevents contamination during boot)
- Answer key is read ONLY after answering and booting
- Pre-boot answers are written to a dotfile (hidden, not indexed)
- The test measures the compaction summary, not the vault — if you read vault
  files before answering, the test is contaminated
