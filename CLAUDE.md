# CLAUDE.md — Dashboard SaaS LinkedIn (Kaizen)

## Mots-clés projet

- `open` → invoquer le skill `.claude/skills/open.md` : briefing du matin — où on en est, ce qui reste à faire, points d'attention
- `close` → invoquer le skill `.claude/skills/close.md` : résumé de fin de session — ce qui a été fait, points ouverts, prochaine étape
- `log` → invoquer le skill `.claude/skills/log.md` : analyse la conversation et met à jour LOGBOOK.md + ROADMAP.md

Ces mots-clés sont réservés à ce projet et ne doivent pas être confondus avec les triggers OMC globaux.

## Skills utiles selon le contexte

Proposer ces skills dans les situations suivantes, sans attendre que ce soit demandé :


/qa : quand une feature est déclarée terminée, avant un déploiement, après un fix pour vérifier l'absence de régression
/investigate : dès qu'une erreur, un 500 ou un comportement inattendu est mentionné
/review : avant tout commit significatif sur main, systématiquement si ça touche auth, RLS ou server actions
/security-review : dès qu'une modification touche auth, permissions, middleware ou données sensibles
/run : pour tester une feature UI dans le vrai browser avant de la déclarer terminée

---

Ce repo est le dashboard client du SaaS LinkedIn Kaizen. Les clients y gèrent leurs agents IA de prospection, voient leurs conversations et configurent leur compte.

**URL prod** : https://saas-kaizen.vercel.app

Documents de pilotage :
- `ROADMAP.md` : état d'avancement par phases (source de vérité du "où on en est")
- `LOGBOOK.md` : journal chronologique des sessions
- `docs/architecture-cible.md` : architecture cible en 4 couches (policy engine, socle, config client, boucle d'apprentissage) issue du challenge de Geoffrey, à lire avant toute décision structurante

## Stack

- Next.js (App Router) déployé sur Vercel
- Supabase (Auth + Postgres) pour l'authentification et les données
- Tailwind CSS pour le style
- TypeScript

## Déploiement Vercel / GitHub

Le repo GitHub est `https://github.com/geoffrey-kaizen-ia/lk-kaizen` (branche `main`).

**État actuel (vérifié le 26/06/2026)** : le repo GitHub EST connecté au projet Vercel `saas-kaizen` (`prj_t7HIVJBx1jvNVZgruw1Zg7FYtWdc`, équipe KAIZEN IA `team_TT5Fb1yJRioCDsAODEFOOdn1`), branche de prod `main`. URL de prod : `saas-kaizen.vercel.app`. Le dossier local est lié à ce projet via `.vercel/project.json`.

**Conséquence pratique** : un simple `git push origin main` déclenche AUTOMATIQUEMENT un déploiement de prod (confirmé par l'historique : chaque commit poussé a un déploiement `source=git`). Pas besoin de `vercel --prod` après un push. La CLI ne sert plus que pour forcer un redéploiement sans nouveau commit, ou pour un test. Faire un `vercel --prod` après un push ne fait que dupliquer inutilement le déploiement déjà parti du git.

**Piège historique (résolu)** : il a longtemps existé un AUTRE projet Vercel `lk-kaizen` (`prj_Xf07eLBWFT39ACR95d7VxUhmvu3s`, org sorek-inc, `lk-kaizen.vercel.app`), déployé à l'origine en CLI sur un repo GitHub vide. Avant le 15/06 ce dossier n'avait même pas de `.git`. Le projet de prod actuel est `saas-kaizen` (créé le 22/06 avec le repo connecté), PAS `lk-kaizen`. Si la prod semble ne pas se mettre à jour, vérifier qu'on regarde bien le projet `saas-kaizen` / org KAIZEN IA dans le dashboard Vercel, et pas l'ancien `lk-kaizen` / sorek-inc qui ne bouge plus.
- n8n (hors repo) : workflows Icebreaker et Conversation qui écrivent dans les tables lk_*

## Connexion Supabase

- URL projet : `https://omwmbqpbwprpaqaphphg.supabase.co` (projet migré sur le compte Supabase de Geoffrey en juin 2026, URL et clés inchangées)
- Clé à utiliser dans le front : **anon key UNIQUEMENT**, jamais la service_role
- Stocker URL et anon key dans `.env.local` (variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`), jamais en dur dans le code
- Utiliser `@supabase/ssr` pour gérer la session côté serveur et client

## Règle de sécurité absolue

La service_role key ne doit JAMAIS apparaître dans ce repo. Tout passe par l'anon key + la session utilisateur. La base est protégée par RLS : un client connecté ne voit QUE ses propres données, c'est géré côté base, pas besoin de filtrer manuellement par client dans les requêtes. Le seul endroit légitime pour la service_role key est n8n (workflows serveur).

## Modèle de données (tables Supabase, préfixe lk_)

La table `crm_contacts` (CRM migré depuis Airtable) vit sur le même projet Supabase mais est hors périmètre de ce dashboard.

### lk_clients_config — la fiche du client

| Colonne        | Type      | Rôle                                                |
| -------------- | --------- | --------------------------------------------------- |
| account_id     | text      | Identifiant Unipile du compte LinkedIn du client    |
| user_id        | uuid      | Lien vers le compte Supabase Auth (= auth.uid())    |
| email          | text      | Email du client                                     |
| full_name      | text      | Nom                                                 |
| is_active      | boolean   | Compte client actif (PAS le statut LinkedIn)        |
| ai_enabled     | boolean   | Kill switch global IA du client (toggle sidebar)    |
| knowledge_base | jsonb     | Infos produit/ton/calendrier                        |

Colonnes de cadence et timing (pilotées par `/dashboard/settings`) :

| Colonne                      | Type      | Rôle                                                          |
| ---------------------------- | --------- | ------------------------------------------------------------- |
| daily_invite_limit           | integer   | Plafond invitations/jour (socle 25, baissable seulement)      |
| daily_message_limit          | integer   | Plafond messages/jour (socle 40, baissable seulement)         |
| response_delay_mode          | text      | Preset de délai : `rapide` / `normal` / `lent`                |
| response_delay_min_minutes   | integer   | Borne basse du délai de réponse en minutes (dérivée du preset) |
| response_delay_max_minutes   | integer   | Borne haute du délai de réponse en minutes                    |
| active_hours_start           | integer   | Heure de début du créneau (0-23, dans `timezone`)             |
| active_hours_end             | integer   | Heure de fin du créneau (0-23)                                |
| active_days                  | int[]     | Jours actifs ISO (1=lundi … 7=dimanche)                       |
| timezone                     | text      | Fuseau IANA pour interpréter heures et jours (def Europe/Paris) |

Les presets de délai (rapide=5-15, normal=30-45, lent=60-120) vivent dans `src/app/dashboard/settings/delayPresets.ts`, source de vérité partagée entre l'UI et la validation server. Le dashboard écrit le mode ET les bornes min/max correspondantes.

**Règle critique** : à l'inscription, il faut créer (ou lier) une ligne `lk_clients_config` avec `user_id = auth.uid()` du nouvel utilisateur ET son `account_id` Unipile. Sans ce lien, le RLS bloque tout et le client ne voit rien. Aujourd'hui le signup ne crée PAS cette ligne (le lien est fait à la main), c'est le chantier onboarding de la Phase 3.

Colonnes de droits d'accès (pilotées manuellement par l'admin Geoffrey dans Supabase) :

| Colonne           | Type      | Rôle                                                                         |
| ----------------- | --------- | ---------------------------------------------------------------------------- |
| allowed_roles     | text[]    | Rôles autorisés pour ce client (ex: `{icebreaker,conversation}`)             |
| can_edit_prompt   | boolean   | Peut modifier le prompt directement (sinon wizard uniquement)                |
| icebreaker_mode   | text      | `ai` (agent IA) ou `template` (message fixe)                                 |
| icebreaker_template | text    | Message fixe si mode template                                                |
| icebreaker_enabled | boolean  | Icebreaker actif ou non                                                      |
| relances_enabled  | boolean   | Option relances activee pour ce client (default true, admin peut desactiver) |

**Angle mort connu** : le badge "LinkedIn connecté" du dashboard repose sur `is_active`, qui veut dire "compte client actif" et pas "LinkedIn réellement connecté". À remplacer par une colonne `linkedin_status` + `last_connected_at` alimentée par le webhook Unipile (voir ROADMAP).

### lk_agents — la bibliothèque de prompts (coeur du produit)

Chaque ligne = un agent IA créé par le client.

| Colonne        | Type    | Rôle                                                                    |
| -------------- | ------- | ----------------------------------------------------------------------- |
| id             | uuid    | Identifiant agent                                                       |
| account_id     | text    | À quel client appartient l'agent                                        |
| name           | text    | Nom de l'agent donné par le client                                      |
| objectif       | text    | Objectif business (texte libre : prise de call, closing, qualification) |
| prompt_content | text    | Le prompt complet de l'agent                                            |
| knowledge_base | jsonb   | Base de connaissance spécifique                                         |
| is_active      | boolean | Agent actif ou archivé                                                  |

Le client a un accès CRUD complet sur ses propres agents. Le wizard de création (`src/app/dashboard/agents/AgentWizard.tsx` + `promptTemplate.ts`) compile des choix structurés (tutoiement, style, critères de qualification, exemples de voix) en un prompt final : c'est l'embryon du "compilateur de config" de l'architecture cible, à renforcer plutôt qu'à remplacer.

### lk_agent_assignments — le sélecteur de rôle

Dit quel agent de la bibliothèque joue quel rôle technique à un instant donné.

| Colonne    | Type | Rôle                                    |
| ---------- | ---- | --------------------------------------- |
| account_id | text | Le client                               |
| role       | text | `icebreaker`, `conversation` ou `intent` |
| agent_id   | uuid | L'agent assigné à ce rôle              |

Clé primaire `(account_id, role)` : un seul agent par rôle et par client à la fois. Le client peut réassigner librement sans supprimer ses agents. Le rôle `intent` (analyse sentiment/score/opt-out) est défini mais son exécution n8n est reportée.

### lk_prospects — les prospects

| Colonne       | Type    | Rôle                                                                       |
| ------------- | ------- | -------------------------------------------------------------------------- |
| account_id    | text    | Le client                                                                  |
| linkedin_id   | text    | Identifiant LinkedIn du prospect                                           |
| full_name     | text    | Nom du prospect                                                            |
| status        | text    | `invited` / `connected` / `in_conversation` / `interested` / `not_interested` |
| message_count | integer | Nb de messages échangés                                                    |
| ai_enabled    | boolean | Off-switch IA par prospect (toggle dans /dashboard/conversations)          |
| processing_status | text | Verrou anti-doublon n8n (`idle` / `processing`)                          |
| scheduled_send_at | timestamptz | Date d'envoi cible d'une réponse, calculée par n8n (file d'attente)  |

Plus des colonnes d'enrichissement alimentées par n8n : profile_summary, occupation, job_title, company_name, scoring, scoring_justification, intent_state, reply_sentiment, nb_relance, last_message_sent_at, last_reply_at, chat_id, etc.

C'est n8n qui écrit ici. Le dashboard lit, et peut UNIQUEMENT mettre à jour `ai_enabled` (policy RLS dédiée). Le garde-fou du workflow n8n Conversation lit aussi `ai_enabled` (unifié le 12/06/2026, l'ancienne colonne jumelle `ia_active` a été supprimée).

### lk_messages — les messages (lecture seule côté dashboard)

| Colonne     | Type        | Rôle             |
| ----------- | ----------- | ---------------- |
| prospect_id | uuid        | À quel prospect  |
| account_id  | text        | Le client        |
| direction   | text        | `inbound` / `outbound` |
| content     | text        | Le message       |
| sent_at     | timestamptz | Date d'envoi     |

C'est n8n qui écrit ici. Le dashboard lit seulement.

### lk_relances — les messages de relance (par client, CRUD complet)

Liste libre et ordonnée de messages fixes envoyés automatiquement quand un prospect ne répond pas. Introduite le 19/06/2026, elle remplace l'ancien modèle (table globale `lk_relance_templates` + pointeurs `relance_1/2_template_id` sur `lk_clients_config`, désormais orphelins en attente de nettoyage).

| Colonne    | Type    | Rôle                                                      |
| ---------- | ------- | --------------------------------------------------------- |
| account_id | text    | Le client (FK lk_clients_config)                          |
| position   | integer | Ordre dans la séquence (1, 2, 3…)                         |
| content    | text    | Le message, variables `{{first_name}}` / `{{last_name}}`  |
| delay_days | integer | Jours sans réponse avant envoi (déf. 3)                   |
| is_active  | boolean | Relance active ou non                                     |

Le client a un CRUD complet sur SES relances (RLS granulaire par account_id, pas de FOR ALL). Édition dans la section "Relances" de `/dashboard/agents`. Contrat n8n (cron de relance) : prochaine relance = `position = nb_relance + 1`, envoyée si `is_active` et `now >= last_message_sent_at + delay_days`. Le rôle "Invitation reçue" (ancien usage du rôle `intent`) a été retiré de l'UI à cette occasion ; l'agent Intent (scoring) est en pause.

## Pipeline n8n (hors repo, mais le dashboard en dépend)

- Workflow Icebreaker (id `0yQOYs1Ffiqtj4IX`) : webhook Unipile `new_relation`, envoie le 1er message
- Workflow Conversation (id `fsSw8bIknV1cAgKx`) : webhook Unipile `message_received`, génère la réponse via l'agent assigné au rôle `conversation`
- Garde-fous du workflow Conversation : event=message_received, is_sender=false, message non vide, rejet WhatsApp, IA active, processing_status=idle
- La stratégie de conversation vit ENTIÈREMENT dans `prompt_content` (lk_agents), pas dans des règles n8n. Le dashboard est l'éditeur de cette stratégie.

### Contrat de timing / cadence à câbler dans n8n (préparé en base le 16/06, PAS encore implémenté)

Le dashboard pose les réglages en base ; n8n doit les consommer ainsi (à faire côté n8n, voir ROADMAP 5.1) :

- **Délai humanisé** : à la réception d'un message à répondre, tirer un entier aléatoire dans `[response_delay_min_minutes, response_delay_max_minutes]` (lus dans `lk_clients_config`).
- **Créneau** : calculer `now + délai` dans le `timezone` du client. Si le résultat tombe hors `[active_hours_start, active_hours_end]` ou sur un jour absent de `active_days`, RECALER au prochain créneau ouvert (début de la prochaine journée active). Ne JAMAIS poser un nœud Wait fixe de plusieurs jours (fragile au redémarrage d'instance).
- **File d'attente** : écrire la date cible dans `lk_prospects.scheduled_send_at`. Un cron n8n (ex toutes les 5 min) sélectionne les prospects dont `scheduled_send_at <= now()` ET IA active, envoie la réponse, puis remet `scheduled_send_at = null`.
- **Cadence** : avant tout envoi, vérifier que le compteur du jour (invitations / messages outbound) n'a pas atteint `daily_invite_limit` / `daily_message_limit` ; sinon, repousser au lendemain.

## Plan de build par phases

L'état d'avancement par phases vit dans `ROADMAP.md` — c'est la source de vérité, ne pas dupliquer ici.

## Intégration Unipile

Unipile gère la connexion aux comptes LinkedIn des clients. L'`account_id` Unipile est la clé centrale de toutes les tables `lk_*`.

- Auth : header `X-API-KEY`, côté serveur uniquement (n8n ou server actions). Env vars : `UNIPILE_BASE_URL` + `UNIPILE_API_KEY`.
- Un account_id Unipile change si le client reconnecte son LinkedIn : toujours lire l'account_id courant dans `lk_clients_config`, jamais en dur.
- Doc de référence : `docs/unipile/` -- lire `docs/unipile/README.md` pour savoir quel fichier consulter avant d'implémenter quoi que ce soit lié à Unipile.

## Conventions

- Pas de double tiret ni de tiret long dans le code, les commentaires ou l'UI
- Code simple et lisible, pas de sur-ingénierie
- Toujours utiliser TypeScript strict
- Composants serveur Next.js par défaut, client (`"use client"`) seulement si nécessaire
- Tenir `LOGBOOK.md` à jour à chaque session de travail, et cocher `ROADMAP.md` quand un chantier avance
