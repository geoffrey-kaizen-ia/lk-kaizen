# Skill : log

Triggered when the user says "log" (alone or "fais un log", "log stp").

## What to do

### Step 1 — Analyze the conversation
Scan the current conversation and identify:
- What was built, fixed, or decided (concrete actions taken)
- What was tested and validated
- Open points explicitly left for later
- Any migrations, schema changes, or n8n workflow changes

### Step 2 — Update LOGBOOK.md
- Read `LOGBOOK.md`
- Add a new entry at the TOP of the file (just below the header and `---`), using today's date in format `## YYYY-MM-DD`
- If an entry for today already exists, APPEND to it instead of creating a new one
- Use short bullet points. One action per bullet. Past tense.
- Group related bullets under sub-topics if needed (no more than 2-3 groups)
- Flag open points with `Point ouvert :` prefix

### Step 3 — Update ROADMAP.md
- Read `ROADMAP.md`
- For each item in the current phase that was completed during this conversation, change `- [ ]` to `- [x]`
- If the work done doesn't match any existing roadmap item but is significant, ADD a new `- [x]` bullet under the relevant phase section
- Do NOT modify checked items, phase headers, or other phases

### Step 4 — Report
Tell the user:
- "LOGBOOK mis à jour" + a 2-line preview of what was added
- "ROADMAP mis à jour" + list the items that were checked (if any), or "aucune case à cocher"

## Rules
- Never invent actions. Only log what actually happened in the conversation.
- If the conversation has nothing to log (no code change, no decision), say so and do nothing.
- Use today's date from context (available in system-reminder as `currentDate`).
- Write in French in the log files (consistent with existing style).
- Keep LOGBOOK entries concise — max ~8 bullets per session block.
