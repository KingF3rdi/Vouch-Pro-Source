# Helix Own — trained local coding agent

Helix Own is our **own agent**: open weights + baked curriculum + IDE tools.
It is trained for **quality code**, **complex projects**, and **codebase understanding**.

> We cannot scrape paid API keys or retrain GPT-class weights from scratch.
> “Training” here = Modelfile system distillation + skill packs + tool workflows.

## Train / install

```bash
npm run train:own   # alias: npm run setup:free
```

This:

1. Pulls `qwen2.5-coder:3b`
2. Creates Ollama model **`helix-own`** from `ollama/HelixOwn.Modelfile`
3. Sets workspace default to Helix Own (`helix-free` profile)

## What it can do

| Capability | How |
| --- | --- |
| Understand complex repos | `understand_project` + project map injected into every chat |
| Quality code | `quality_check` + `skills/code-quality` |
| Complex greenfield apps | `scaffold_project` + `skills/complex-projects` |
| Fix/verify loop | unlimited tool steps until checks pass |

## Skills (training pack)

- `skills/agent-curriculum`
- `skills/complex-projects`
- `skills/code-quality`

## Run

```bash
npm run dev
```

Pick **Helix Own** in the model picker (default without paid keys).
