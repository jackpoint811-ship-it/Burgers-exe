#!/usr/bin/env python3
"""
Compatibility entrypoint for UI/UX Pro Max.

The skill is installed for Codex Cloud under:
  .agents/skills/ui-ux-pro-max/

Some generated instructions reference:
  skills/ui-ux-pro-max/scripts/search.py

This shim keeps those commands working by forwarding execution to the real script.
"""
from pathlib import Path
import runpy
import sys

repo_root = Path(__file__).resolve().parents[3]
real_script = repo_root / ".agents" / "skills" / "ui-ux-pro-max" / "scripts" / "search.py"

if not real_script.exists():
    raise FileNotFoundError(f"UI/UX Pro Max script not found: {real_script}")

sys.path.insert(0, str(real_script.parent))
runpy.run_path(str(real_script), run_name="__main__")
