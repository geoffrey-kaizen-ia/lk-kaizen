# Skill : open

Triggered when the user says "open" (alone or "fais un open", "open du matin").

## What to do

1. Read `LOGBOOK.md` (find the most recent session entry to know where we left off)
2. Read `ROADMAP.md` (full file — identify current phase, checked and unchecked items)
3. Output a structured morning brief in French:

```
## Briefing du JJ/MM/AAAA

### Contexte : où on en est
<1-3 sentences summarizing the current phase and overall project status — what's live, what's in progress>

### Dernière session : on s'était arrêté où ?
- <2-4 bullets from the most recent LOGBOOK entry — what was done and any open points>

### À faire maintenant
- <next unchecked items in current ROADMAP phase, ordered by logical priority>
- Flag any item marked "Point ouvert" in the LOGBOOK as a priority if still open

### Points d'attention
- <anything explicitly flagged as blocked, waiting on someone, or needing a decision>
- <any known dependency: n8n, Unipile, Geoffrey, etc.>

### Plus tard (backlog)
- <unchecked items in future phases worth keeping in mind — max 3>
```

## Rules
- Use today's date from context (`currentDate` in system-reminder).
- "À faire maintenant" must only contain items from the CURRENT phase (the one marked EN COURS in ROADMAP). Never pull from future phases.
- "Plus tard" can reference future phases but keep it to max 3 items.
- Do NOT invent priorities or suggest architectural changes — only surface what is written.
- If LOGBOOK has no recent entry (>7 days), note it explicitly under "Dernière session".
- Write in French, concise, actionable tone.
