"""Thin LLM wrapper.

Provider is chosen from the environment:
  PROVENANCE_LLM_PROVIDER = anthropic | openai_compat | mock
                            (default: anthropic if ANTHROPIC_API_KEY is set,
                             openai_compat if PROVENANCE_LLM_BASE_URL is set,
                             else mock)
  PROVENANCE_LLM_MODEL    = model id (default: claude-opus-5)
  PROVENANCE_LLM_BASE_URL = OpenAI-compatible endpoint base (openai_compat),
                            e.g. https://api.openai.com/v1
  PROVENANCE_LLM_API_KEY  = key for openai_compat endpoints

openai_compat talks to any /chat/completions-style endpoint via urllib (no
extra dependency) — covers whichever provider the organizers hand over.

Mock mode returns cached JSON from mocks/<cache_key>.json when present and
None otherwise — callers must handle None with a deterministic fallback, so
the whole pipeline runs fully offline without a key.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

MOCK_DIR = Path(__file__).resolve().parent / "mocks"
_ENV_FILE = Path(__file__).resolve().parent / ".env"


def _load_env_file() -> None:
    """Tiny .env loader (no dependency): KEY=VALUE lines, # comments.
    Keys set in the file WIN over ambient environment variables — an explicit
    line in the project's .env is more intentional than whatever the shell
    happened to inherit (e.g. a stray ANTHROPIC_BASE_URL)."""
    if not _ENV_FILE.exists():
        return
    for line in _ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and value:
            os.environ[key] = value


_load_env_file()


class LLMClient:
    def __init__(self) -> None:
        provider = os.environ.get("PROVENANCE_LLM_PROVIDER")
        if not provider:
            if os.environ.get("ANTHROPIC_API_KEY"):
                provider = "anthropic"
            elif os.environ.get("PROVENANCE_LLM_BASE_URL"):
                provider = "openai_compat"
            else:
                provider = "mock"
        self.provider = provider
        self.model = os.environ.get("PROVENANCE_LLM_MODEL", "claude-opus-5")
        self._client = None

    # -- public API ---------------------------------------------------------

    def complete_json(self, system: str, user: str,
                      cache_key: Optional[str] = None) -> Optional[dict]:
        """Ask for a JSON object; returns a parsed dict, or None when the
        mock provider has no cached answer for cache_key."""
        if self.provider == "mock":
            return self._mock(cache_key)
        if self.provider == "openai_compat":
            return self._openai_compat(system, user)
        return self._anthropic(system, user)

    # -- providers ----------------------------------------------------------

    def _mock(self, cache_key: Optional[str]) -> Optional[dict]:
        if not cache_key:
            return None
        safe = re.sub(r"[^A-Za-z0-9_.-]", "_", cache_key)
        path = MOCK_DIR / f"{safe}.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return None

    def _anthropic(self, system: str, user: str) -> Optional[dict]:
        import anthropic

        if self._client is None:
            self._client = anthropic.Anthropic()
        kwargs = {}
        # Determinism on reruns of the same jury case. Only for compatible
        # third-party endpoints (custom base URL): current first-party Claude
        # models reject sampling parameters, and the SDK no longer exposes
        # them as named arguments — so send via extra_body.
        if os.environ.get("ANTHROPIC_BASE_URL"):
            kwargs["extra_body"] = {"temperature": 0.0}
        try:
            resp = self._client.messages.create(
                model=self.model,
                max_tokens=16000,
                system=system,
                messages=[{"role": "user", "content": user}],
                **kwargs,
            )
        except anthropic.APIError:
            return None  # degrade to the deterministic fallback
        if resp.stop_reason == "refusal":
            return None
        text = "".join(b.text for b in resp.content if b.type == "text")
        return _parse_json_block(text)

    def _openai_compat(self, system: str, user: str) -> Optional[dict]:
        base = os.environ.get("PROVENANCE_LLM_BASE_URL", "").rstrip("/")
        if not base:
            return None
        model = os.environ.get("PROVENANCE_LLM_MODEL", "gpt-5")
        req = urllib.request.Request(
            f"{base}/chat/completions",
            data=json.dumps({
                "model": model,
                "temperature": 0,  # deterministic reruns of the same case
                "messages": [{"role": "system", "content": system},
                             {"role": "user", "content": user}],
            }).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization":
                    f"Bearer {os.environ.get('PROVENANCE_LLM_API_KEY', '')}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            text = payload["choices"][0]["message"]["content"] or ""
        except (urllib.error.URLError, KeyError, IndexError, TypeError,
                json.JSONDecodeError, TimeoutError):
            return None  # degrade to the deterministic fallback
        return _parse_json_block(text)


def _parse_json_block(text: str) -> Optional[dict]:
    """Extract the first JSON object from a model reply (fences tolerated)."""
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = m.group(1) if m else None
    if candidate is None:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end <= start:
            return None
        candidate = text[start:end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None
