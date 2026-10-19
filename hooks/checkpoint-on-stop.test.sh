#!/bin/bash
# checkpoint-on-stop.test.sh — bash hooks/checkpoint-on-stop.test.sh [hook]. Temp vault + bare upstream; 4 cases.
# Mutant check (2026-10-19): the pre-0.8.11 hook fails "clean+ahead: pushed" only.
H="${1:-$(cd "$(dirname "$0")" && pwd)/checkpoint-on-stop.sh}"; T=$(mktemp -d); pass=0; fail=0
git init -q --bare "$T/up.git"
mkdir -p "$T/w/.knowledge/meta"; cd "$T/w"; git init -q; git config user.email t@t; git config user.name t
echo s > .knowledge/meta/session-state.md; echo l > .knowledge/.last-checkpoint.log;  # tracked, as in real vaults (Fondant, Baguette)
 git add -A; git commit -qm init; git remote add origin "$T/up.git"; git push -q -u origin HEAD 2>/dev/null
run(){ git checkout -q -- .knowledge/.last-checkpoint.log 2>/dev/null; MARK=$(git rev-parse HEAD); printf '{"cwd":"%s"}' "$T/w" | KNOWLEDGE_VAULT= bash "$H"; }
chk(){ if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "PASS $1"; else fail=$((fail+1)); echo "FAIL $1 (want $2 got $3)"; fi; }
# 1 clean + pushed -> no run
run; chk "clean+pushed: no checkpoint" unchanged "$([ -z "$(git status --porcelain)" ] && echo unchanged || echo ran)"
# 2 clean + ahead -> run, pushed
echo a >> .knowledge/meta/session-state.md; git commit -qam manual; run
chk "clean+ahead: pushed" 0 "$(git rev-list --count @{u}..HEAD)"
# 3 dirty -> commit + push
echo b >> .knowledge/meta/session-state.md; run
chk "dirty: committed+pushed" "0 0" "$(git status --porcelain .knowledge | grep -v last-checkpoint.log | wc -l | tr -d ' ') $(git rev-list --count @{u}..HEAD)"
# 4 no upstream, clean -> no run, rc 0
git checkout -q -- .knowledge/.last-checkpoint.log; git commit -qam settle 2>/dev/null; git push -q 2>/dev/null; git branch -q --unset-upstream; run; rc=$?
chk "clean+no-upstream: no checkpoint, rc0" "unchanged 0" "$([ -z "$(git status --porcelain)" ] && echo unchanged || echo ran) $rc"
echo "pass=$pass fail=$fail"; rm -rf "$T"
[ "$fail" = 0 ]
