# AGENTS.md

## Rules — always apply

**`rules.md`** (repo root) contains a five-question pre-send checklist. Run it on EVERY answer before sending. Failing one question → fix it before sending.

## Skills — always auto-invoke

The skills in `skills/` are active project instructions. Do not wait to be asked — invoke them automatically whenever their trigger condition occurs:

- **`skills/decision-surfaces/`** — run automatically BEFORE finalizing the first plan for a non-trivial new project or major feature, and again only after a material scope change or newly discovered boundary. Record material surfaces in `docs/decision-surfaces.md` and ask the user only about choices they must own.
- **`skills/ce-plan/`** — use automatically whenever the user asks to plan, break down, or deepen a change. Produce the plan artifact and stop; do not start implementation automatically.
- **`skills/ljg-plain/`** — use automatically when the user asks for a plain-language explanation ('plain', 'grok', 'explain it simply', '白话', '说人话').
- **`skills/concise-chat/`** — ALWAYS active for every chat response: get to the point, short sentences, no narration, prefer doing over explaining, stop once the message is delivered.

Skill precedence: concise-chat governs all output style; the other three trigger on their conditions above. These skills apply to every session in this repo from now on.

## Project context

This repo hosts the Lou's Place referral navigation tool MVP (Next.js + PostgreSQL, provider-neutral LLM adapter). No application code exists yet — the product plan was approved in chat on 2026-09-05.
