"""加载本地配置：把 .env.local 读进 os.environ（密钥不入库）。"""
from __future__ import annotations

import os
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]


def load_env(path: str | Path | None = None) -> None:
    """读取 .env.local（KEY=VALUE，# 注释）。已存在的环境变量不覆盖。"""
    env_path = Path(path) if path else _ROOT / ".env.local"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key, val = key.strip(), val.strip()
        if key and key not in os.environ:
            os.environ[key] = val
