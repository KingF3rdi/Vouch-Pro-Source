#!/usr/bin/env python3
"""OpenAI-compatible chat server for Helix Own LoRA weights (port 11435)."""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

ROOT = Path(__file__).resolve().parents[1]
META = ROOT / "training" / "output" / "helix-own-lora" / "helix_own_ft.json"
DEFAULT_BASE = os.environ.get("HELIX_FT_BASE", "Qwen/Qwen2.5-Coder-0.5B-Instruct")

app = FastAPI(title="Helix Own FT")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_model = None
_tokenizer = None
_ready_error: str | None = None


def load_model() -> None:
    global _model, _tokenizer, _ready_error
    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer

        base = DEFAULT_BASE
        adapter = None
        if META.exists():
            meta = json.loads(META.read_text(encoding="utf-8"))
            base = meta.get("base_model", base)
            adapter = meta.get("adapter_path")

        _tokenizer = AutoTokenizer.from_pretrained(adapter or base, trust_remote_code=True)
        if _tokenizer.pad_token is None:
            _tokenizer.pad_token = _tokenizer.eos_token

        model = AutoModelForCausalLM.from_pretrained(
            base,
            torch_dtype=torch.float32,
            trust_remote_code=True,
        )
        if adapter and Path(adapter).exists():
            model = PeftModel.from_pretrained(model, adapter)
        model.eval()
        _model = model
        _ready_error = None
        print(f"[helix-ft-serve] loaded base={base} adapter={adapter}")
    except Exception as exc:  # noqa: BLE001
        _ready_error = str(exc)
        print(f"[helix-ft-serve] load failed: {exc}")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage]
    max_tokens: int = Field(default=512, alias="max_tokens")
    temperature: float = 0.2

    model_config = {"populate_by_name": True}


@app.on_event("startup")
def _startup() -> None:
    load_model()


@app.get("/health")
def health():
    return {
        "ok": _model is not None,
        "error": _ready_error,
        "model": "helix-own-ft",
    }


@app.get("/v1/models")
def models():
    return {
        "data": [
            {"id": "helix-own-ft", "object": "model"},
            {"id": "helix-own", "object": "model"},
        ]
    }


@app.post("/v1/chat/completions")
def chat(req: ChatRequest):
    if _model is None or _tokenizer is None:
        return {
            "error": {
                "message": _ready_error or "Helix Own FT model not loaded. Run npm run train:weights",
            }
        }

    import torch

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    prompt = _tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = _tokenizer(prompt, return_tensors="pt")
    with torch.no_grad():
        out = _model.generate(
            **inputs,
            max_new_tokens=min(req.max_tokens, 1024),
            do_sample=req.temperature > 0,
            temperature=max(req.temperature, 0.01),
            pad_token_id=_tokenizer.eos_token_id,
        )
    new_tokens = out[0][inputs["input_ids"].shape[-1] :]
    text = _tokenizer.decode(new_tokens, skip_special_tokens=True)
    return {
        "id": "helix-own-ft",
        "object": "chat.completion",
        "model": "helix-own-ft",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("HELIX_FT_PORT", "11435")))
