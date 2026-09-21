# Helix Own — weight training

Real **LoRA SFT** on `Qwen/Qwen2.5-Coder-0.5B-Instruct` using our curriculum dataset.

```bash
npm run train:weights          # LoRA train → training/output/helix-own-lora
npm run serve:ft               # OpenAI-compatible server :11435
npm start                      # train if needed + IDE
```

## Artifacts

- Dataset: `training/dataset/helix_own_sft.jsonl`
- Adapter: `training/output/helix-own-lora/adapter/` (~28MB)
- Meta: `training/output/helix-own-lora/helix_own_ft.json`

Helix Free / Helix Own prefers the FT server when `:11435` is healthy.

## Simple usage

1. `npm start`
2. Welcome → **Loslegen**
3. Chat with Helix Own (essential skills + tools on by default)
