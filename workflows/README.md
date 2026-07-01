# Workflows n8n

Fichiers JSON de workflows n8n, prets a importer.

## crash-test-agent.json

Workflow d'orchestration du crash test des agents. Declenche par le dashboard
(webhook), il joue les 13 scenarios de securite via la route `/api/crash-test/run-all`
et ecrit le verdict en base avec le `service_role` (cote n8n, jamais dans le repo).

### Import

Dans n8n : menu du workflow → **Import from File** (choisir ce `.json`) ou
**Import from Clipboard** (coller le contenu).

### A regler apres l'import (4 points)

1. **Credential Supabase** : sur chacun des **6 noeuds Supabase**, selectionner la
   credential Supabase existante (celle avec le `service_role`).
2. **URL** : noeud "Run all scenarios", remplacer `REMPLACER-URL-PREVIEW` par
   l'URL de deploiement (preview Vercel de la branche, ou prod plus tard).
3. **Secret** : meme noeud, remplacer `REMPLACER-SECRET` par la valeur de
   `CRASH_TEST_API_SECRET` (la meme que cote Vercel).
4. **Activer** le workflow, copier l'URL du webhook (onglet Production) et la
   poser dans Vercel comme variable `N8N_CRASH_TEST_URL`.

### Flux

Webhook (`agent_id`, `trigger`) → Get agent → Create run → Set testing →
Run all scenarios (route `/run-all`) → Finalize run (verdict) →
Finalize agent (validated / failed) → Prepare results → Insert results.

Le dashboard ne fait que declencher et calculer. n8n orchestre et ecrit le
verdict, ce qui le rend infalsifiable cote client.
