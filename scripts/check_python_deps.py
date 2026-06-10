"""Verify that required API dependencies are importable.

This keeps `make install` usable on machines where dependencies are already
installed globally and the venv was created with system site packages.
"""

from __future__ import annotations

import importlib.util
import sys

REQUIRED = ["fastapi", "uvicorn", "pytest", "httpx"]


def main() -> int:
    missing = [name for name in REQUIRED if importlib.util.find_spec(name) is None]

    if missing:
        print(
            "Missing Python dependencies after pip install failed: "
            + ", ".join(missing),
            file=sys.stderr,
        )
        return 1

    print("pip install failed, but required Python dependencies are importable.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
