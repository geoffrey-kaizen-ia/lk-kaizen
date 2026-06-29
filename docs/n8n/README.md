# n8n - Index des workflows Kaizen

Source de vérité des workflows n8n qui tournent en prod (hors repo, mais le dashboard en dépend).
Lire ce fichier en premier pour savoir quel JSON consulter avant de répondre à toute question liée à un workflow.

Les `.json` ici sont des exports n8n **nettoyés** (secrets caviardés). Ne pas charger un JSON sans raison :
certains font des centaines de lignes. Repérer le bon via le tableau ci-dessous.

Instance n8n : `https://n8n.srv1213804.hstgr.cloud`

## Les workflows

| Workflow | ID n8n | Fichier | Rôle | Statut | Dernier export |
| --- | --- | --- | --- | --- | --- |
| Génère lien de connexion | `wtLJvVIhegJj8szS` | [genere-lien-connexion.json](genere-lien-connexion.json) | Webhook `unipile-connect` : génère le lien Unipile Hosted Auth pour brancher un compte LinkedIn | actif | 29/06/2026 |
| Unipile Notify Callback | `i8kR9LQwN8S1GPoH` | [unipile-notify-callback.json](unipile-notify-callback.json) | Webhook `unipile-notify` : à la connexion, écrit `account_id` + `is_active` dans lk_clients_config, puis recrée le webhook Unipile `message_received` global | actif | 29/06/2026 |
| Kaizen - Icebreaker LinkedIn | `0yQOYs1Ffiqtj4IX` | [icebreaker.json](icebreaker.json) | Webhook `new_relation` : génère et envoie le 1er message (mode IA ou template), crée le prospect, gère cadence/créneau | actif | 29/06/2026 |
| Kaizen - Conversation LinkedIn | `fsSw8bIknV1cAgKx` | [conversation.json](conversation.json) | Webhook `message_received` : réponse via l'agent du rôle `conversation` + scoring + file d'attente `scheduled_send_at` | actif | 29/06/2026 |
| Cron - Envoi invitations quotidien | `u9NRd0JkerDhuipM` | [cron-invitations-scraping.json](cron-invitations-scraping.json) | Cron : scraping campagnes (lk_searches) + envoi invitations avec quota/créneau (lk_search_results) | actif | 29/06/2026 |
| Kaizen- IceBreaker #2 (legacy) | `IBiW7XPBmFjupoWy` | [icebreaker-legacy-airtable.json](icebreaker-legacy-airtable.json) | Ancien flux brise-glace basé Airtable, remplacé par Icebreaker LinkedIn | **désactivé** (à archiver) | 29/06/2026 |

## Mettre à jour un workflow (process)

1. Dans l'UI n8n : ouvrir le workflow, menu `...` > `Download`.
2. Déposer le `.json` brut dans `.n8n-raw/` à la racine du repo (dossier **ignoré par git**, jamais poussé).
3. Lancer `node docs/n8n/sanitize.mjs` : il caviarde les secrets et écrit la copie propre ici, avec un nom de fichier stable basé sur l'ID du workflow.
4. Mettre à jour la date « Dernier export » dans le tableau ci-dessus.
5. Vérifier avant commit : `git diff` + `grep -RnE "eyJ|X-API-KEY|service_role" docs/n8n/*.json` (doit ne rien remonter de sensible).

## Sécurité (IMPORTANT)

- Les exports n8n contiennent des **secrets en clair** là où les clés sont tapées en dur dans un node (header `X-API-KEY`, ou `const KEY = '...'` dans un node Code). Les nodes qui utilisent un **credential n8n** (`httpHeaderAuth`, `supabaseApi`) n'exposent que l'`id`/`name` du credential, pas le secret.
- `sanitize.mjs` caviarde : tout JWT (→ `___REDACTED_JWT___`, ça couvre la `service_role` et l'`anon`) et les clés Unipile connues (→ `___REDACTED_UNIPILE_KEY___`). Toute nouvelle clé en dur repérée doit être ajoutée à `KNOWN_SECRETS` dans le script.
- **Jamais** committer `.n8n-raw/`. **Jamais** la `service_role` dans ce repo (règle absolue du projet).

### ⚠️ Clé service_role à faire tourner (rotation en attente)

Repéré le 29/06/2026 : la `service_role` Supabase et deux clés Unipile étaient **en dur** dans plusieurs workflows (cron, notify). À considérer comme **compromises**. Chantier ouvert :
1. Régénérer la `service_role` dans Supabase (invalide la clé fuitée).
2. Remplacer tous les usages en dur dans n8n par un **credential** (comme c'est déjà fait pour les nodes `supabaseApi` / `httpHeaderAuth`), pour qu'elle ne réapparaisse plus jamais dans un export.

## Rappels métier (toujours valables)

- **Garde-fous du workflow Conversation** : `event=message_received`, `is_sender=false`, message non vide, IA active (`ai_enabled`), `processing_status=idle`, et exclusion du compte test Geoffrey (`account_id != BY85po44SUyPqFR8pbrm0Q`).
- **La stratégie de conversation vit dans `prompt_content` (lk_agents)**, pas dans des règles n8n. Le JSON ne porte que la plomberie (sauf le prompt système de l'icebreaker IA, embarqué en dur dans le node Claude de l'Icebreaker LinkedIn).
- **Modifier un workflow live = guider Nicolas pas à pas dans l'UI n8n, jamais via le SDK** (`update_workflow` interdit).
- **Délai / créneau** : nodes Code "Code in JavaScript1/3" calculent `scheduled_send_at` (luxon `DateTime`) à partir de `response_delay_*`, `active_hours_*`, `active_days`, `timezone` de lk_clients_config.
