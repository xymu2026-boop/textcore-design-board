"""Prompt asset loading for LLM pipeline stages."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROMPTS_DIR = ROOT / "prompts"


def load_stage_prompt(stage_filename: str, *, rules: tuple[str, ...] = ()) -> str:
    prompt = (PROMPTS_DIR / "stages" / stage_filename).read_text(encoding="utf-8").strip()
    if not rules:
        return prompt

    parts = [prompt, "\n# Included Rules"]
    for rule in rules:
        rule_text = (PROMPTS_DIR / "rules" / rule).read_text(encoding="utf-8").strip()
        parts.append(f"\n## {rule}\n{rule_text}")
    return "\n".join(parts)
