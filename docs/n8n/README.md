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
| Kaizen - Icebreaker LinkedIn - Invitation acceptée | `0yQOYs1Ffiqtj4IX` | [icebreaker-invitation.json](icebreaker-invitation.json) | Webhook `unipile-new-relation` : à l'acceptation d'invitation, **génère** l'icebreaker (Claude) et crée le prospect avec le texte en attente. N'envoie pas. | actif | 30/06/2026 |
| Kaizen - Icebreaker LinkedIn - Schedule envoie message | `HdUkHiDzT9gpTvgV` | [icebreaker-message.json](icebreaker-message.json) | Schedule (sur les minutes) : pioche les prospects à envoyer et **envoie** l'icebreaker via Unipile, dédup chat, écrit lk_messages | actif | 30/06/2026 |
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

## Icebreaker scindé en deux (30/06/2026)

L'ancien Icebreaker unique a été coupé en deux workflows pour que le **log d'exécutions des invitations acceptées reste lisible** (le schedule qui tourne sur les minutes noyait le journal). Ils ne s'appellent pas directement : **ils communiquent par la table `lk_prospects`**.

- **Invitation acceptée** (`0yQOYs1Ffiqtj4IX`, a gardé l'ID de l'ancien) : webhook `unipile-new-relation`. Exclut le compte test Geoffrey, lit config/assignation/prompt, récupère profil + posts Unipile, vérifie l'invite SaaS (`lk_search_results.status=invited`), génère l'icebreaker via Claude, puis **crée** la ligne `lk_prospects` avec `status=connected`, le texte généré dans **`pending_reply`**, la date d'envoi cible dans **`scheduled_send_at`**, et `ai_enabled`. Il **n'envoie rien**.
- **Schedule envoie message** (`HdUkHiDzT9gpTvgV`) : `scheduleTrigger` sur les minutes (⚠️ l'export ne porte pas de valeur d'intervalle explicite, donc n8n applique 1 min par défaut ; Nicolas évoque 5 min — à confirmer dans l'UI). Pioche `lk_prospects` où `status=connected` ET `scheduled_send_at <= now` ET `ai_enabled=true` ET `processing_status != processing`. Re-vérifie côté client `ai_enabled` ET `icebreaker_enabled`, dédoublonne (chat déjà ouvert / déjà contacté), **envoie** l'icebreaker via Unipile, écrit `lk_messages` (`direction=outbound`, `message_type=icebreaker`), passe le prospect en `in_conversation`, puis **vide** `pending_reply` et `scheduled_send_at`.

Contrat de liaison : un prospect « prêt à recevoir l'icebreaker » = `status=connected` + `pending_reply` rempli + `scheduled_send_at` échu. Une fois envoyé, ces deux champs sont remis à null et le statut passe à `in_conversation`.

## Rappels métier (toujours valables)

- **Garde-fous du workflow Conversation** : `event=message_received`, `is_sender=false`, message non vide, IA active (`ai_enabled`), `processing_status=idle`, et exclusion du compte test Geoffrey (`account_id != BY85po44SUyPqFR8pbrm0Q`).
- **La stratégie de conversation vit dans `prompt_content` (lk_agents)**, pas dans des règles n8n. Le JSON ne porte que la plomberie (sauf le prompt système de l'icebreaker IA, embarqué en dur dans le node Claude de l'Icebreaker LinkedIn).
- **Modifier un workflow live = guider Nicolas pas à pas dans l'UI n8n, jamais via le SDK** (`update_workflow` interdit).
- **Délai / créneau** : nodes Code "Code in JavaScript1/3" calculent `scheduled_send_at` (luxon `DateTime`) à partir de `response_delay_*`, `active_hours_*`, `active_days`, `timezone` de lk_clients_config.
