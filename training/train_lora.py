#!/usr/bin/env python3
"""
Helix Own — real LoRA weight training (SFT) on a small coding model.

Trains adapter weights (not just a system prompt) and saves them under training/output/helix-own-lora.
Designed for CPU or GPU. Uses Qwen2.5-Coder-0.5B-Instruct by default.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "training" / "dataset" / "helix_own_sft.jsonl"
DEFAULT_OUT = ROOT / "training" / "output" / "helix-own-lora"
DEFAULT_MODEL = os.environ.get("HELIX_FT_BASE", "Qwen/Qwen2.5-Coder-0.5B-Instruct")


def load_rows(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    if len(rows) < 2:
        raise SystemExit(f"Need more training rows in {path}")
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="LoRA SFT for Helix Own")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--steps", type=int, default=int(os.environ.get("HELIX_FT_STEPS", "40")))
    parser.add_argument("--max-length", type=int, default=384)
    args = parser.parse_args()

    print(f"[helix-ft] base={args.model}")
    print(f"[helix-ft] data={args.data}")
    print(f"[helix-ft] out={args.out}")
    print(f"[helix-ft] steps={args.steps}")

    import torch
    from datasets import Dataset
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        DataCollatorForLanguageModeling,
        Trainer,
        TrainingArguments,
    )

    rows = load_rows(args.data)
    # Light augmentation: duplicate with slight system emphasis
    augmented = list(rows)
    for row in rows:
        clone = json.loads(json.dumps(row))
        if clone["messages"] and clone["messages"][0]["role"] == "system":
            clone["messages"][0]["content"] += " Prefer tools and verification."
        augmented.append(clone)

    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    def to_text(example: dict) -> dict:
        text = tokenizer.apply_chat_template(
            example["messages"],
            tokenize=False,
            add_generation_prompt=False,
        )
        return {"text": text}

    dataset = Dataset.from_list(augmented).map(to_text)

    def tokenize(batch: dict) -> dict:
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=args.max_length,
            padding="max_length",
        )

    tokenized = dataset.map(tokenize, batched=True, remove_columns=dataset.column_names)

    dtype = torch.float32
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        torch_dtype=dtype,
        trust_remote_code=True,
    )
    model.config.use_cache = False

    lora = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    args.out.mkdir(parents=True, exist_ok=True)
    training_args = TrainingArguments(
        output_dir=str(args.out / "checkpoints"),
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        max_steps=args.steps,
        logging_steps=5,
        save_steps=max(args.steps, 1),
        save_total_limit=1,
        report_to=[],
        remove_unused_columns=False,
        fp16=False,
        bf16=False,
        optim="adamw_torch",
        warmup_steps=max(1, args.steps // 10),
        dataloader_num_workers=0,
    )

    collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized,
        data_collator=collator,
    )
    trainer.train()

    adapter_dir = args.out / "adapter"
    adapter_dir.mkdir(parents=True, exist_ok=True)
    trainer.model.save_pretrained(adapter_dir)
    tokenizer.save_pretrained(adapter_dir)

    meta = {
        "base_model": args.model,
        "adapter_path": str(adapter_dir),
        "steps": args.steps,
        "method": "lora-sft",
        "dataset": str(args.data),
        "samples": len(augmented),
    }
    (args.out / "helix_own_ft.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[helix-ft] saved adapter → {adapter_dir}")
    print("[helix-ft] done")


if __name__ == "__main__":
    main()
