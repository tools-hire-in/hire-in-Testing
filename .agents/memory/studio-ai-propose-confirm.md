---
name: Studio AI propose→confirm pattern
description: Bulk AI generation flows in Content Studio must be two-step (preview, then confirm) — never insert AI output directly.
---

Rule: any Studio flow where AI generates multiple pipeline records (campaign plans, repurpose batches) must split into a preview endpoint (AI only, returns suggestions, zero writes) and a confirm endpoint (accepts human-edited rows, re-validates every row server-side with validateIdeaTypeAndChannels, then bulk-inserts as origin ai/repurposed + status "suggested").

**Why:** Code review rejected a single-step "/plan" route that inserted AI output immediately — it violates the "AI proposes, never publishes" guardrail because the human had no edit point before rows landed in the pipeline.

**How to apply:** New AI batch-generation endpoints follow generate-*-preview + confirm-* naming; confirm validates ALL rows before inserting ANY (no partial plans); notifications fire only on confirm. Single-record AI fills (e.g. outreach step drafting into an editable draft) are exempt since the record stays draft and editable.
