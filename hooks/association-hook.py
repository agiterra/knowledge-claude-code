#!/usr/bin/env python3
"""UserPromptSubmit hook: inject associative memory context.

Reads the user prompt from stdin (Claude Code hook JSON), runs association
search against the knowledge vault, and outputs brief context for injection.

Designed to be fast (<500ms). If search fails or returns nothing, outputs
nothing (empty stdout = no context injection).

Stdin: {"prompt": "...", "session_id": "...", "cwd": "...", ...}
Stdout: plain text context (added to Claude's view) or nothing
"""

import glob
import importlib.util
import json
import os
import sys
import time

HOOK_DIR = os.path.dirname(os.path.abspath(__file__))
PLUGIN_ROOT = os.path.dirname(HOOK_DIR)


def _find_dep_script(dep_name: str, script_name: str) -> str | None:
    """Find a script in a dependency plugin's scripts/ directory.

    Resolution order:
    1. Sibling in the same marketplace dir (PLUGIN_ROOT/../../<dep>/<ver>/scripts/)
    2. Any marketplace in the plugin cache (~/.claude/plugins/cache/*/<dep>/*/scripts/)
    """
    # Strategy 1: sibling under same marketplace
    marketplace_dir = os.path.dirname(os.path.dirname(PLUGIN_ROOT))
    siblings = sorted(
        glob.glob(os.path.join(marketplace_dir, dep_name, "*", "scripts", script_name)),
        key=os.path.getmtime,
        reverse=True,
    )
    if siblings:
        return siblings[0]

    # Strategy 2: any marketplace in the cache
    cache_dir = os.path.join(os.path.expanduser("~"), ".claude", "plugins", "cache")
    matches = sorted(
        glob.glob(os.path.join(cache_dir, "*", dep_name, "*", "scripts", script_name)),
        key=os.path.getmtime,
        reverse=True,
    )
    return matches[0] if matches else None


SEARCH_MODULE = _find_dep_script("knowledge-tools", "association-search.py")

# Cache the loaded module
_search_mod = None


def _load_search():
    global _search_mod
    if _search_mod is not None:
        return _search_mod
    if SEARCH_MODULE is None or not os.path.isfile(SEARCH_MODULE):
        return None
    spec = importlib.util.spec_from_file_location("association_search", SEARCH_MODULE)
    if spec is None or spec.loader is None:
        return None
    _search_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(_search_mod)
    return _search_mod


def main():
    t0 = time.time()

    try:
        raw = sys.stdin.read()
        hook_input = json.loads(raw)
    except Exception:
        sys.exit(0)

    prompt = hook_input.get("prompt", "")
    if not prompt or len(prompt) < 10:
        sys.exit(0)

    search = _load_search()
    if search is None:
        sys.exit(0)

    try:
        result = search.search_associations(prompt, top_k=8, vector_limit=5)
        assocs = result.get("results", [])
    except Exception as e:
        print(f"[assoc-hook] search error: {e}", file=sys.stderr)
        sys.exit(0)

    if not assocs:
        sys.exit(0)

    lines = []
    seen_sources = set()
    for a in assocs[:5]:
        source = a.get("source", "")
        if source in seen_sources:
            continue
        seen_sources.add(source)

        atype = a.get("type", "")
        summary = a.get("summary", "")[:120]
        score = a.get("score", 0)

        if score < 0.1:
            continue

        if atype == "vault":
            lines.append(f"  {source}: {summary}")
        elif atype == "journal":
            lines.append(f"  {source}: {summary}")
        else:
            lines.append(f"  [{atype}] {source}: {summary}")

    elapsed_ms = int((time.time() - t0) * 1000)

    if lines:
        print(f"[Associations ({elapsed_ms}ms)]")
        print("\n".join(lines))

    sys.exit(0)


if __name__ == "__main__":
    main()
