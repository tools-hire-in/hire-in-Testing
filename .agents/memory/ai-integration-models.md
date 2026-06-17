---
name: AI integration chat models
description: Which chat models work through the Replit AI_INTEGRATIONS OpenAI proxy and a token pitfall
---

Chat completions for this repo go through the Replit AI integration proxy using
`AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL` (NOT `OPENAI_API_KEY`,
which is unset). Image client uses `gpt-image-1`, audio uses `gpt-audio`.

For chat/structured-output, `gpt-5.4` is a valid model id through the proxy and reliably
returns content. `gpt-5` and `gpt-5-mini` are also accepted but are reasoning models:
with a small `max_completion_tokens` (e.g. 20) they return an EMPTY message because the
reasoning tokens consume the whole budget. 

**Why:** Spent debugging time thinking `gpt-5.4` was a typo and that gpt-5 models were
"broken" — they aren't, the budget was just too small for reasoning + visible output.

**How to apply:** When a gpt-5* chat call returns empty content, raise
`max_completion_tokens` before assuming the model is wrong. For structured-output draft
generation, `gpt-5.4` (standard/strong tier) and `gpt-5-mini` (economy) both work.
