# Roadmap — Dashboard Kaizen

Vue d'ensemble du projet par phases. Pour le detail jour par jour, voir [LOGBOOK.md](./LOGBOOK.md).
Pour la doctrine d'architecture (4 couches, referentiel V1/V2, harness d'eval), voir [docs/architecture-cible.md](./docs/architecture-cible.md).

Etat verifie contre le code et la base le 12/06/2026.

## Phase 1 — Squelette + securite (TERMINEE, validee le 08/06)

- [x] Scaffold Next.js App Router + TypeScript + Tailwind v4
- [x] Supabase via @supabase/ssr (client browser/server/middleware)
- [x] Pages /login et /signup (avec code d'acces SIGNUP_ACCESS_CODE)
- [x] Middleware de protection des routes /dashboard
- [x] Page /dashboard/agents qui lit lk_agents sous RLS sans filtre manuel

## Phase 2 — Bibliotheque de prompts (TERMINEE)

- [x] CRUD complet sur lk_agents (createAgent, updateAgent, archiveAgent, deleteAgent)
- [x] Wizard de creation d'agent (AgentWizard + promptTemplate : choix structures compiles en prompt)
- [x] Assignation des roles icebreaker / conversation / intent (upsertAssignment / removeAssignment)
- [x] Système de droits par client (17/06) : `allowed_roles` (forfait admin, protégé) + `is_enabled` par rôle (préférence client) + `can_edit_prompt` (accès écriture prompt). Page admin `/dashboard/admin` pour Geoffrey. Gardes-fous câblés dans n8n Conversation.
- [x] Mode icebreaker template (17/06) : choix Agent IA / Message fixe directement dans la carte Icebreaker de /dashboard/agents. Toggle on/off independant. Variables `{{first_name}}` / `{{last_name}}`. Formules n8n documentees (substitution regex + delai humanise depuis config client).

## Phase 3 — Onboarding + LinkedIn + conversations (EN COURS)

Deja fait :
- [x] Flux aller "Connecter LinkedIn" : bouton -> server action -> webhook n8n -> Unipile hosted auth (envoie deja user_id comme identifiant de correspondance)
- [x] Page /dashboard/conversations : liste prospects + fil de messages + toggle IA par prospect (ai_enabled)
- [x] Page /dashboard/stats : KPIs, cohortes hebdo, messages par jour
- [x] Kill switch global IA dans la sidebar (lk_clients_config.ai_enabled)
- [x] Geoffrey relie manuellement (user_id <-> lk_clients_config)

Reste a faire :
- [x] Bug ia_active / ai_enabled corrige le 12/06 : node If n8n bascule sur ai_enabled, colonne ia_active droppee de lk_prospects, Geoffrey Cuberos remis coherent (ai_enabled=false)
- [x] Relier Anthony manuellement (compte Auth + update user_id) fait le 15/06 (LOT 0), en attendant l'onboarding auto
- [ ] Signup qui cree/lie la ligne lk_clients_config (aujourd'hui rien n'est cree a l'inscription)
- [ ] Workflow n8n retour notify_url Unipile -> UPSERT lk_clients_config (service_role key cote n8n uniquement)
- [ ] Decision design : la ligne lk_clients_config existe des l'inscription (recommande) ou est creee au retour Unipile ?
- [ ] Colonne linkedin_status + last_connected_at (remplace is_active pour le badge/bouton LinkedIn)
- [ ] Reactiver la confirmation email Supabase avant la prod (desactivee pour le dev)

## Phase 4 — Pipeline agents conversationnels n8n (EN COURS)

- [x] Architecture posee : strategie = prompt_content, 3 roles, workflows Icebreaker (0yQOYs1Ffiqtj4IX) et Conversation (fsSw8bIknV1cAgKx)
- [x] Colonnes de controle sur lk_prospects (processing_status, scoring, intent_state, etc.)
- [x] Bugs majeurs du workflow Conversation corriges le 10/06 (node inexistant, message sortant duplique, garde-fou WhatsApp)
- [x] Webhooks Unipile new_relation + message_received configures et actifs (kaizen-new-relation, kaizen-message-recu, account_ids=[] = tous les comptes)
- [x] NOUVEAU PIPELINE "Nouveaux prospects" (cote dashboard, base sur le workflow d'Anthony de recherche LinkedIn via Unipile) : page `/dashboard/prospects` cree le 12/06 avec formulaire de recherche (mots-cles, localisation, distance reseau, nb max 50, option envoi auto des invitations) et liste des resultats groupes par recherche (validation/selection manuelle ou auto-invite). Table `lk_search_results` creee (migration `create_lk_search_results`, RLS calquee sur lk_prospects). Server actions `launchSearch` / `toggleResultSelection` / `sendSelectedInvitations` appellent un webhook n8n via `N8N_PROSPECT_SEARCH_URL`. Sidebar mis a jour.
- [x] Webhook n8n "prospect-search" deja en place le 15/06 (workflow "Scrapping", `/webhook/Scrapping`, anciennement note EN ATTENTE) : resout location via `/linkedin/search/parameters`, appelle `/linkedin/search` (classic/people), ecrit dans `lk_search_results`, gere `auto_invite` -> `/users/invite`. Le point ROADMAP precedent etait obsolete.
- [x] Feature 4/6 (ciblage + preview) amorcee le 15/06, puis corrigee le 15/06 (suite 5) une fois le vrai schema Unipile classic/people connu :
  - `industry` (include uniquement, tableau plat d'IDs resolus via `/search/parameters?type=INDUSTRY`) est le SEUL filtre de secteur supporte par classic/people. Pas d'exclusion de secteur, pas de champ `role`/exclusion de poste (Recruiter API uniquement, hors V1). Les "postes a eviter" sont filtres cote n8n sur le `headline` (mots-cles bruts).
  - `industry` n'est JAMAIS renvoye par classic/people (toujours null) et il n'y a pas de champ entreprise dans la reponse. Champ "Sauf dans ce secteur" retire de l'UI et du payload (no-op). `current_company` est desormais extrait au mieux depuis le `headline` via regex cote n8n.
  - Migration `add_industry_company_to_lk_search_results` (colonnes `industry`, `current_company` sur `lk_search_results`) toujours utile pour `current_company`. Formulaire `/dashboard/prospects` : champs "Dans quel secteur ?", "Postes a eviter" + validation nb profils (1-50, vide = 50) + bouton "Ignorer la selection" en masse. `launchSearch` envoie `industry` et `exclude_titles` (plus de `exclude_industry`).
  - Nodes n8n "Resolve location & build payload1" et "Flatten + metadata1" corriges et confirmes fonctionnels par Nicolas.
- [x] ANTI-DOUBLON recherches repetees (15/06 suite 5) : contrainte `UNIQUE (account_id, provider_id)` ajoutee sur `lk_search_results` (migration `dedup_lk_search_results_unique_provider`, doublons existants nettoyes). Active immediatement, evite les doublons d'insertion meme sans le reste de la strategie.
- [ ] EN PAUSE (15/06 suite 5, "trop complexe, faut que je reflechisse") : memoire de curseur de pagination pour eviter de re-scanner les memes profils a chaque recherche. Table `lk_searches` deja creee (migration `create_lk_searches_cursor_memory`, RLS posee) mais INERTE. Plan complet (8 nodes : query_hash, "Lire curseur", reprise de pagination dans "Resolve location & build payload1", "Lire IDs existants" + anti-join dans "Flatten + metadata1", "Supabase insert" Continue On Fail, "Calc curseur" + "Sauver curseur") concu mais non implemente. A reprendre a la demande de Nicolas.
- [x] Webhooks doublons sur le compte de Geoffrey (Geoffrey - New Relation LinkedIn + Geoffrey_LinkedIn_message_entrant) nettoyes le 15/06 (LOT 0).
- [ ] Verifier les endpoints Unipile profil/posts
- [ ] Brancher les credentials HTTP (X-API-KEY) sur tous les nodes HTTP
- [ ] Test de bout en bout : vrai message LinkedIn -> inbound + outbound en base + ordre correct dans le dashboard
- [ ] Agent intent (3e role) : execution n8n reportee, a replanifier
- [ ] Workflow Icebreaker #2 (IBiW7XPBmFjupoWy) migre Airtable -> Supabase multi-clients : cron lit tous les account_id de lk_clients_config, boucle par client, ecrit dans lk_prospects. JSON de base genere le 12/06 (/tmp/kaizen-icebreaker-supabase.json). EN STANDBY : Nicolas doit recuperer un ancien workflow comme exemple avant de finir le branchement (credential Supabase service_role, nodes LLM resume/generation/If, node d'envoi du 1er message).
- [ ] Linting deterministe avant envoi (Couche 3 architecture-cible) : bug observe sur un ancien wf, le LLM a insere un mot en hindi (devanagari) en pleine phrase FR. Node Code propose (regex caracteres non-latins + autres regles : pas de lien/prix au 1er message, longueur max, pas de tiret long) mais pas encore genere/colle. A faire au prochain point.
- [x] ANTI-DOUBLON Icebreaker #2 regle le 15/06 (LOT 0) : contrainte UNIQUE (account_id, linkedin_id) + upsert ajoutee.

## Phase 5 — Architecture cible (NOUVEAU, issu du challenge Geoffrey du 12/06)

Detail complet dans [docs/architecture-cible.md](./docs/architecture-cible.md). Regle d'or : le LLM redige, le code decide ce qui part.

### 5.1 Policy engine (protections en code, pas dans le prompt)
- [ ] Inventorier les regles vitales aujourd'hui implicites ou dans les prompts (volumes, horaires, relances, opt-out, liens/prix au 1er message)
- [ ] Les implementer en nodes deterministes n8n + colonnes/contraintes Supabase, avant et apres l'appel LLM
- [ ] Arret immediat sur opt-out + etiquetage de la conversation
- [x] Plafonds de volume quotidien (colonnes daily_invite_limit/daily_message_limit + reglage response_delay_mode ajoutes le 12/06 sur lk_clients_config, page /dashboard/settings cree). RESTE A FAIRE : ces plafonds ne sont PAS encore lus par n8n (Icebreaker, Conversation, ni le wf d'invitations sortantes d'Anthony a synchroniser) -> juste le terrain prepare cote base/UI pour l'instant.
- [x] Delais de reponse en minutes + creneaux horaires + jours actifs (16/06) : colonnes response_delay_min_minutes/response_delay_max_minutes, active_hours_start/end, active_days, timezone ajoutees a lk_clients_config + colonne scheduled_send_at sur lk_prospects (file d'attente). Page /dashboard/settings refondue : sliders de cadence, presets de delai affichant les minutes, section creneaux (plage horaire + jours + fuseau). Contrat n8n documente dans CLAUDE.md.
- [x] Bugfixes page /dashboard/settings (17/06) : UPDATE -> upsert (faux succes silencieux quand lk_clients_config absente), listes TIMEZONES et SOCLE_MAX_* centralisees dans delayPresets.ts (etaient dupliquees entre SettingsClient et actions).
- [x] Architecture file d'attente decidee (16/06 suite) : colonne `pending_reply text` ajoutee sur lk_prospects (migration `add_pending_reply_to_lk_prospects`). Un seul chemin d'envoi via WF Cron (pas de IF, pas de doublon de logique). Cas double message couvert par overwrite naturel de pending_reply.
- [ ] EN COURS — WF Conversation a modifier : ajouter noeud "Code - Calcul timing" (tirage aleatoire [delay_min, delay_max] + recalage creneau active_hours/active_days/timezone) + modifier "Supabase - Update prospect" pour ecrire pending_reply + scheduled_send_at + supprimer Unipile Envoyer et SB Message sortant de ce WF.
- [ ] EN COURS — WF Cron a finir (structure Schedule -> Get Many Rows -> IF deja en place) : cabler apres IF -> Unipile Envoyer -> SB Message sortant -> SB Update prospect (remet pending_reply=null, scheduled_send_at=null).
- [ ] EN PAUSE (mis de cote le 12/06) : branchement du garde-fou "Check plafond quotidien" dans le workflow Conversation (fsSw8bIknV1cAgKx). Plan defini : ajouter un node Supabase "Compteur du jour" (count lk_messages outbound du jour pour le account_id) + un node If comparant a daily_message_limit (deja dans Supabase - Config client via select *), juste apres le node "Supabase - Config client" et avant "Unipile - Historique". Si plafond atteint : Supabase Update lk_prospects.processing_status='idle' et fin de branche. Pas encore implemente, priorite redirigee vers le scraping.

### 5.2 Socle vs config client + compilateur
- [ ] Scinder le prompt actuel en socle Kaizen (commun, versionne) et config client (parametrique)
- [ ] Renforcer le wizard en vrai compilateur de config : validation des champs libres contre le socle, refus des contradictions
- [ ] Precedence ecrite dans l'architecture : regles legales > socle > config client
- [ ] Versionnage : socle vX + config vY stockes, traces sur chaque message envoye (journal d'audit)

### 5.3 Harness d'evaluation
- [ ] Linting deterministe des messages generes (bloque l'envoi en cas d'echec)
- [ ] Banque de personas adversariaux + golden set 60-80 scenarios (regression du socle)
- [ ] LLM-juge avec grille calibree sur 30-50 conversations annotees a la main (accord > 85%)
- [ ] Eval de config client automatique a l'onboarding (60-100 scenarios, rapport montre au client)
- [ ] Shadow mode + autonomie graduee (brouillon -> semi-auto -> full auto, passage sur donnees)

### 5.4 Boucle d'apprentissage post-deploiement
- [ ] Echantillonnage hebdo 10-15% des vraies conversations repassees au juge
- [ ] Taxonomie d'erreurs + correction au bon endroit (socle si transverse, config si client)
- [ ] Non-regression golden set + deploiement canary (2-3 clients pilotes)
- [ ] Clause d'apprentissage anonymise dans les CGV avant le premier client SaaS

### Decisions strategiques a trancher (avant d'ecrire plus de code Phase 5)
- [ ] SaaS pour qui : cockpit interne d'abord (recommandation Geoffrey) ou self-serve ?
- [ ] Doctrine transparence IA : reponse honnete imposee par le socle a "vous etes un bot ?"

## Feature 1 — Handover manuel (EN COURS)

- [x] Bouton "Profil LinkedIn" + descriptif (occupation) sous le nom dans /dashboard/conversations (lien linkedin_url, deja en base et alimente par n8n)
- [x] Toggle "desactiver l'IA / prise en main manuelle" par prospect (existait deja, ai_enabled)
- [x] Feature 2 (mode test agent type Thissmart) : bouton "Tester" sur chaque agent de /dashboard/agents, ouvre une modal de chat qui appelle directement l'API Anthropic (claude-sonnet-4-6) avec le meme gabarit de prompt que le node "Claude - Reponse" du workflow n8n Conversation (system=prompt_content, historique/dernier message/infos prospect/nb echanges). Profil du prospect simule editable (entreprise/poste/resume). Rien n'est ecrit en base. RESTE A FAIRE : Nicolas doit renseigner ANTHROPIC_API_KEY dans .env.local.
- [x] Clarification des 3 types d'agents sur /dashboard/agents (15/06) : bandeau explicatif des roles, choix du type d'agent (conversation / icebreaker / invitation recue) dans le wizard avec formulaire et gabarit de prompt dedies pour les types "premier message", badge "Premier message" sur les agents concernes, et mode test par persona simule (TestFirstMessageModal) calque sur le node "Claude - Icebreaker" du workflow n8n Icebreaker. Le role "intent" (lk_agent_assignments) est desormais utilise pour "Invitation recue".

## Priorites court terme (au 16/06/2026)

1. Finir le WF Conversation : ecrire le noeud "Code - Calcul timing" (tirage aleatoire + recalage creneau) + modifier SB Update prospect + supprimer Unipile Envoyer et SB Message sortant
2. Finir le WF Cron : cabler les 3 noeuds apres le IF (Unipile Envoyer + SB Message sortant + SB Update prospect qui remet a null)
3. Test de bout en bout du workflow Conversation avec la file d'attente
4. Trancher les 2 decisions strategiques avec Geoffrey, puis sequencer la Phase 5
5. Cabler le retour Unipile notify_url (Phase 3)
6. EN ATTENTE NICOLAS : reprendre la memoire de curseur de pagination (lk_searches) quand il aura reflechi a la strategie anti-doublons
