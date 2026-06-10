"""Run backend checks with a ruff fallback for Phase 0."""

from __future__ import annotations

import compileall
import importlib.util
import subprocess
import sys
from pathlib import Path

CHECK_PATHS = ["apps/api", "textcore", "tests"]


def main() -> int:
    if importlib.util.find_spec("ruff") is not None:
        return subprocess.call([sys.executable, "-m", "ruff", "check", *CHECK_PATHS])

    print("ruff is not installed; running placeholder Python compile check.")
    ok = True
    for path in CHECK_PATHS:
        ok = compileall.compile_dir(Path(path), quiet=1) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
