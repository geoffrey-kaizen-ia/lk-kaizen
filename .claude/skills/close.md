# Skill : close

Triggered when the user says "close" (alone or in context like "fais un close", "close la session").

## What to do

1. Read `LOGBOOK.md` (full file — find today's entry or the most recent session entry)
2. Read `ROADMAP.md` (full file — identify current phase and checked/unchecked items)
3. Output a structured summary in French with these 4 sections:

```
## Bilan du JJ/MM/AAAA

### Fait aujourd'hui
- <bullet list from today's LOGBOOK entry>

### En cours / points ouverts
- <items started but not finished, or explicitly flagged as "à faire">

### Bloqué / en attente
- <anything waiting on external action: n8n, Unipile, Geoffrey, etc.>

### Prochaine étape
- <next unchecked item(s) in ROADMAP.md current phase, or explicit "next" from LOGBOOK>
```

## Rules
- If there is no LOGBOOK entry for today, use the most recent entry and note its date.
- Keep bullets short (one line max each).
- Do NOT invent information — only surface what is literally written in the two files.
- Do NOT suggest roadmap changes or give opinions. Pure summary.
