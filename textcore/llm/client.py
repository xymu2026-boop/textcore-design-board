"""统一 LLM 适配器：多模型一个接口，结构化输出 + Schema 校验重试。

设计：
- provider 可换（deepseek 用 OpenAI 兼容接口；mock 供离线/测试）。
- 所有结构化调用走 complete_json：返回经 JSON Schema 校验的 dict，不合则带错误反馈重试。
- 不让 LLM "记住流程"：每次调用无状态，system/user 现拼。
"""
from __future__ import annotations

import json
import os
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol

import jsonschema


class LLMError(RuntimeError):
    pass


@dataclass
class LLMResult:
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""


class Provider(Protocol):
    def chat(self, system: str, user: str, *, model: str, json_mode: bool) -> LLMResult: ...


# ---------------------------------------------------------------- DeepSeek
class DeepSeekProvider:
    """DeepSeek 的 OpenAI 兼容 /chat/completions。用 httpx 直连，不引入 openai 依赖。"""

    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key or os.environ.get("DEEPSEEK_API_KEY", "")
        self.base_url = (base_url or os.environ.get("DEEPSEEK_BASE_URL")
                         or "https://api.deepseek.com").rstrip("/")
        if not self.api_key:
            raise LLMError("缺少 DEEPSEEK_API_KEY")

    def chat(self, system: str, user: str, *, model: str, json_mode: bool) -> LLMResult:
        import httpx

        payload: dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.3,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        resp = httpx.post(
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json=payload,
            timeout=120,
        )
        if resp.status_code != 200:
            raise LLMError(f"DeepSeek HTTP {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        usage = data.get("usage", {})
        return LLMResult(
            text=data["choices"][0]["message"]["content"],
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            model=model,
        )


# ---------------------------------------------------------------- Mock
class MockProvider:
    """离线/测试：用一个 handler(system,user)->str 决定返回，便于断言流程。"""

    def __init__(self, handler: Callable[[str, str], str]):
        self.handler = handler
        self.calls: list[tuple[str, str]] = []

    def chat(self, system: str, user: str, *, model: str, json_mode: bool) -> LLMResult:
        self.calls.append((system, user))
        return LLMResult(text=self.handler(system, user), model=model)


# 阶段→模型路由（省钱：粗活便宜，全局判断用强模型）。第一版都走 deepseek-chat。
STAGE_MODEL = {
    "S2": "deepseek-chat",
    "S4": "deepseek-chat",
    "S6": "deepseek-chat",
    "S7": "deepseek-chat",
    "S8": "deepseek-chat",
}
DEFAULT_MODEL = "deepseek-chat"


class LLMClient:
    def __init__(self, provider: Provider | None = None):
        self._provider = provider

    @property
    def provider(self) -> Provider:
        if self._provider is None:
            self._provider = DeepSeekProvider()
        return self._provider

    def model_for(self, stage: str) -> str:
        return STAGE_MODEL.get(stage, DEFAULT_MODEL)

    def complete_json(
        self,
        system: str,
        user: str,
        schema: dict[str, Any],
        *,
        stage: str = "",
        model: str | None = None,
        max_retries: int = 3,
    ) -> tuple[dict[str, Any], LLMResult]:
        """返回 (校验通过的 dict, LLMResult)。不合 Schema 则带错误反馈重试。"""
        mdl = model or self.model_for(stage)
        validator = jsonschema.Draft202012Validator(schema)
        cur_user = user
        last_err = ""
        for _attempt in range(1, max_retries + 1):
            res = self.provider.chat(system, cur_user, model=mdl, json_mode=True)
            try:
                obj = json.loads(res.text)
            except json.JSONDecodeError as e:
                last_err = f"JSON 解析失败: {e}"
                cur_user = f"{user}\n\n上次输出不是合法 JSON（{e}）。只输出合法 JSON。"
                continue
            errors = sorted(validator.iter_errors(obj), key=lambda e: e.path)
            if not errors:
                return obj, res
            last_err = "; ".join(f"{list(e.path)}: {e.message}" for e in errors[:5])
            cur_user = (
                f"{user}\n\n上次输出不符合 Schema：{last_err}。请严格按 Schema 修正后只输出 JSON。"
            )
        raise LLMError(f"{stage or 'LLM'} 重试 {max_retries} 次仍不合 Schema：{last_err}")
