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
- [x] Modification d'agent + masquage prompt (26/06, retour Geoffrey) : le bouton "Modifier" rouvre le wizard pré-rempli depuis `knowledge_base` (édition de tous les champs → régénération auto du prompt → `updateAgent`). Prompt Kaizen totalement masqué aux clients sans `can_edit_prompt`, à la création comme à la modification (encart neutre, bouton Tester conservé).
- [x] REFONTE WIZARD (26/06, retour Geoffrey) : longueur d'accroche (court/moyen/long) injectée comme cible caractères dans le prompt, lien objectif conditionnel au mode proposition directe, "Terrain d'ouverture" reformulé + helper, préremplissage nom (compte) / business (dernier agent), exemples concrets "Instructions supplémentaires". Tags multi-valeurs (postes/secteurs) rattachés au scraping.
- [ ] RETOUR ONBOARDING (26/06) : qualité du 1er message (trop long, tirets, pas assez naturel) — 3 formulations du prompt `firstMessageTemplate` (exemples de style = forme pas longueur, consigne de longueur) EN ATTENTE de validation Geoffrey avant de garder/revert.

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
- [x] FILE D'ATTENTE D'INVITATIONS (22/06) : migration `campagnes_prospection_v1` (extension lk_searches + lk_search_results, UNIQUE account_id+provider_id). Cron quotidien cable dans le workflow n8n `u9NRd0JkerDhuipM` : lit les clients actifs, respecte les creneaux horaires/jours/quota, envoie les profils `selected` via Unipile, met a jour le statut en base et cree les prospects dans lk_prospects. Teste et valide de bout en bout.
- [x] CRON SCRAPING PROGRESSIF (22/06) : branche 2 du workflow `u9NRd0JkerDhuipM` (Schedule 8h30). Lit les campagnes actives, scrape 50 profils/jour via cursor Unipile, insère dans `lk_search_results`, met à jour `lk_searches` (last_cursor, total_scraped, status). Testé et validé.
- [x] Webhook n8n "prospect-search" deja en place le 15/06 (workflow "Scrapping", `/webhook/Scrapping`, anciennement note EN ATTENTE) : resout location via `/linkedin/search/parameters`, appelle `/linkedin/search` (classic/people), ecrit dans `lk_search_results`, gere `auto_invite` -> `/users/invite`. Le point ROADMAP precedent etait obsolete.
- [x] Feature 4/6 (ciblage + preview) amorcee le 15/06, puis corrigee le 15/06 (suite 5) une fois le vrai schema Unipile classic/people connu :
  - `industry` (include uniquement, tableau plat d'IDs resolus via `/search/parameters?type=INDUSTRY`) est le SEUL filtre de secteur supporte par classic/people. Pas d'exclusion de secteur, pas de champ `role`/exclusion de poste (Recruiter API uniquement, hors V1). Les "postes a eviter" sont filtres cote n8n sur le `headline` (mots-cles bruts).
  - `industry` n'est JAMAIS renvoye par classic/people (toujours null) et il n'y a pas de champ entreprise dans la reponse. Champ "Sauf dans ce secteur" retire de l'UI et du payload (no-op). `current_company` est desormais extrait au mieux depuis le `headline` via regex cote n8n.
  - Migration `add_industry_company_to_lk_search_results` (colonnes `industry`, `current_company` sur `lk_search_results`) toujours utile pour `current_company`. Formulaire `/dashboard/prospects` : champs "Dans quel secteur ?", "Postes a eviter" + validation nb profils (1-50, vide = 50) + bouton "Ignorer la selection" en masse. `launchSearch` envoie `industry` et `exclude_titles` (plus de `exclude_industry`).
  - Nodes n8n "Resolve location & build payload1" et "Flatten + metadata1" corriges et confirmes fonctionnels par Nicolas.
- [x] ANTI-DOUBLON recherches repetees (15/06 suite 5) : contrainte `UNIQUE (account_id, provider_id)` ajoutee sur `lk_search_results` (migration `dedup_lk_search_results_unique_provider`, doublons existants nettoyes). Active immediatement, evite les doublons d'insertion meme sans le reste de la strategie.
- [x] MEMOIRE DE CURSEUR DE PAGINATION (17/06) : implementee dans le WF "Scrapping". Table `lk_searches` desormais active. Noeuds ajoutes : `Code - Compute hash` (djb2 pur JS, normalise keywords+location+network+industry), `HTTP - Lire curseur` (GET PostgREST service_role, alwaysOutputData), `HTTP - Upsert lk_searches` (PATCH filtre account_id+query_hash), `Recherche epuisee` (IF exhausted) + `Reponse - Recherche epuisee`. `Resolve location` lit le cursor, `Search profiles` le passe en query param. `Supabase - Inserer resultats` en continueErrorOutput (anti-doublon UNIQUE ligne par ligne). Dashboard `launchSearch` affiche "Plus de profils disponibles" si exhausted. Le cursor Unipile est un base64 `{start,params}` sans expiration.
- [ ] BUGS WF Scrapping releves a la review du 17/06, A CORRIGER : (1) `Supabase - Marquer invite` (branche auto-invite) sans filtre = passe TOUTE la table en "invited" ; (2) connexion `HTTP - Upsert lk_searches -> Flatten` fait tourner Flatten/insert 2x ; (3) webhook en responseNode mais branches recherche-normale et send_invitations sans noeud Respond = 500 cote dashboard. Mineurs : cursor envoye en double (body + query param), `exhausted` detecte avec 1 run de retard.
- [x] FIX SCRAPING OBJECTIF CLIENT (24/06) : `max_results` hardcode a 50 dans `actions.ts` corrige -> envoie desormais le vrai `targetCount` au webhook. Option A implementee dans les 3 noeuds Code du cron 8h30 : comptage reel des lignes en base (PostgREST count=exact), `pageLimit=Math.min(50, remaining)`, insert avec on_conflict+ignore-duplicates, recompte reel apres insert. Contrainte `lk_searches_status_check` corrigee (ajout de 'archived'). UI prospects : section Archives accordeon, clamping compteurs, sent_at pour la date d'invitation. Page /dashboard/prospects/invited creee (pagination 50/page, filtres campagne/nom/date).
- [x] Webhooks doublons sur le compte de Geoffrey (Geoffrey - New Relation LinkedIn + Geoffrey_LinkedIn_message_entrant) nettoyes le 15/06 (LOT 0).
- [x] FIX SCRAPING SECTEUR (26/06, retour Karine) : cause racine = texte libre ("agroalimentaire") ne matche pas la taxonomie LinkedIn → filtre abandonné. Solution : sélecteur recherche+choix `IndustryPicker` (server action `searchIndustries` via Unipile `/search/parameters?type=INDUSTRY`), stocke `industry_id` + libellé, envoie l'ID au webhook. Format `industry: [id]` confirmé (pas `{include:[id]}`). Validé par test djteks (résultats finance/banque ciblés). Filtre `industry: [id]` côté n8n inchangé (marche dès que l'ID/libellé est valide).
- [x] FILTRE 1er DEGRÉ (26/06) : `if (p.network_distance === 'DISTANCE_1') return false;` ajouté dans les 2 nœuds de scraping n8n (`Flatten + metadata1` + `Code - Resolve et Scrape Unipile`) → les contacts déjà connectés ne sont plus insérés.
- [ ] LANGUE DES SECTEURS (26/06, demandé par le boss) : les libellés secteur sortent en anglais même sur un compte LinkedIn FR (inconsistant, non forçable via API). Solution à instruire : liste FR maison (id → libellé) harvestée une fois depuis Unipile, recherche/affichage du sélecteur dessus (l'`industry_id` reste language-independent → filtre OK partout).
- [x] FIX SCROLL MODALES (26/06) : modale "Nouvelle campagne" (et détail campagne, wizard agents) inutilisable sur petit écran — boutons "Lancer"/"Annuler" hors de portée car pas de scroll. Overlay scrollable (`items-start`+`overflow-y-auto`+`py-8`), `overscroll-contain`, verrou scroll page (`html`+`body`) tant qu'une modale est ouverte.
- [x] SECTEUR EN ANGLAIS (26/06) : clarifié — libellés `IndustryPicker` dans la langue du compte LinkedIn, non forçable via l'API Unipile (`locale` ignoré). Cosmétique seulement, on filtre sur `industry_id` (language-independent). Mapping FR maison = optionnel, pas prioritaire.
- [x] TITRES DE POSTE À PUCES (26/06) : champ "Quel profil cherches-tu ?" passé en saisie multi-valeurs (`TitlePicker.tsx`). Plusieurs titres ciblables, assemblés en `"x" OR "y"` côté code (LinkedIn ne traite pas la virgule comme un OU, cf `docs/unipile/search.md`). Ajout Entrée/virgule/blur, anti-doublon, texte en cours capté même sans Entrée. `keywords_list` stocké dans `query_params` pour ré-éditer à la duplication ; rétro-compat ancien texte libre. Pipeline n8n inchangé. Pas de tags transversaux prospects (campagne = unité de segmentation).
- [ ] Verifier les endpoints Unipile profil/posts
- [ ] Brancher les credentials HTTP (X-API-KEY) sur tous les nodes HTTP
- [ ] Test de bout en bout : vrai message LinkedIn -> inbound + outbound en base + ordre correct dans le dashboard
- [ ] Agent intent (3e role) : execution n8n reportee, a replanifier
- [ ] Workflow Icebreaker #2 (IBiW7XPBmFjupoWy) migre Airtable -> Supabase multi-clients : cron lit tous les account_id de lk_clients_config, boucle par client, ecrit dans lk_prospects. JSON de base genere le 12/06 (/tmp/kaizen-icebreaker-supabase.json). EN STANDBY : Nicolas doit recuperer un ancien workflow comme exemple avant de finir le branchement (credential Supabase service_role, nodes LLM resume/generation/If, node d'envoi du 1er message).
- [ ] Linting deterministe avant envoi (Couche 3 architecture-cible) : bug observe sur un ancien wf, le LLM a insere un mot en hindi (devanagari) en pleine phrase FR. Node Code propose (regex caracteres non-latins + autres regles : pas de lien/prix au 1er message, longueur max, pas de tiret long) mais pas encore genere/colle. A faire au prochain point.
- [x] ANTI-DOUBLON Icebreaker #2 regle le 15/06 (LOT 0) : contrainte UNIQUE (account_id, linkedin_id) + upsert ajoutee.
- [ ] EN COURS (23/06) — ICEBREAKER EN FILE D'ATTENTE (WF `0yQOYs1Ffiqtj4IX`) : meme principe que Conversation. Flux webhook modifie (Code - Calcul timing + Creer prospect en `status=connected` avec pending_reply + scheduled_send_at, plus de Wait/envoi direct) ; nouveau flux cron 5 min (Get prospects dus -> IF pending non vide -> Loop batch 1 -> Unipile POST /chats/ attendees_ids -> log message icebreaker -> Update prospect chat_id reel + in_conversation -> Wait 30s -> reboucle). Schedule desactive. RESTE A FAIRE : Test A (ligne de test Nicolas->Geoffrey + filtre account_id temporaire sur Get + run manuel), confirmer champs `chat_id`/`message_id` de la reponse Unipile, puis activer le Schedule.

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
- [x] Point 9 (23/06) — Test agent sur VRAI profil LinkedIn : champ "URL profil" dans TestFirstMessageModal + server action `scrapeLinkedInProfile` (Unipile `GET /api/v1/users/{identifier}` pour le profil, `GET /api/v1/users/{provider_id}/posts` pour les posts). Logs debug retires. Termine et valide.

## Feature 2 — CRM prospects (EN COURS)

- [x] Page /dashboard/pipeline : tableau CRM complet avec filtres (statut, score, IA, recherche texte) + pagination 10/25/50 (17/06). Sidebar renommee : "CRM" + "Recherche prospects".
- [x] Toggle rapport quotidien (23/06) : champ `daily_report` sur `lk_clients_config` (default true), toggle dans /dashboard/settings section Notifications, server action `updateDailyReport`.
- [ ] V2 — Colonne Score (scoring/icp_score) : cachee pour l'instant car jamais alimentee. A reintroduire quand l'agent intent (rôle "Invitation recue") sera cable et produira un score reel par prospect.
- [ ] ABANDONNE (19/06) — Workflow "Invitation recue" (role intent) : la carte de role a ete retiree de /dashboard/agents, le role `intent` n'est plus expose cote client. L'agent Intent (scoring) reste en PAUSE. Remplace par les Relances ci-dessous.
- [x] RELANCES (22/06, architecture finale) : workflow n8n "Relance" (tSXHBrq1Kti67qYx) entierement refait — single-loop sur `lk_relances` (position, content, delay_days, is_active), N niveaux supportes, delay dynamique, guards chat_id/last_message_sent_at/statut, substitution `{{first_name}}`/`{{last_name}}`. UI `/dashboard/agents` : section "Relances automatiques" inline (2 cartes Relance 1 / Relance 2, textarea + chips variables + delay + toggle + save). Plus de modal, plus de lk_agents pour les relances.
- [ ] NETTOYAGE (apres verif n8n d'Anthony) : dropper la table globale `lk_relance_templates`, les colonnes `relance_1/2_template_id` de lk_clients_config et les valeurs `relance_1`/`relance_2` du CHECK `lk_agent_assignments`, devenues orphelines. Agents `lk_agents` avec agentType=relance : laisser en base (inoffensifs) ou supprimer.
- [ ] Point ouvert : agent intent / scoring branché par Anthony dans le WF Conversation — a confirmer et tester bout en bout (scoring, intent_state, reply_sentiment ecrits dans lk_prospects + visibles CRM).

## Feature 3 — Agent intent / scoring (V1, PRIORITE)

- [ ] Migration : ajouter colonne `conversation_summary text` sur `lk_prospects`
- [ ] n8n WF Conversation : inserer 4 noeuds apres "Supabase - Message entrant" et AVANT "Code - Calcul timing" : (1) Claude - Analyse intent (system prompt fixe Kaizen + historique Unipile en user message), (2) Code - Parse JSON intent, (3) Supabase - Update scoring prospect (scoring, scoring_justification, intent_state, reply_sentiment, conversation_summary), (4) IF - Opt-out ? -> OUI : Supabase desactive IA + STOP / NON : continue vers Calcul timing. Prompt pret, voir session 17/06.
- [ ] Si `opt_out` detecte : ecrire `ai_enabled=false` + `status=not_interested` automatiquement.
- [ ] Verification bout en bout (a faire avant de declarer la Feature 3 livree) : des qu'un message est analyse par le node "Claude - Analyse intent", verifier que scoring / intent_state / reply_sentiment sont bien ecrits dans lk_prospects (node "Supabase - Update scoring") ET visibles immediatement dans le CRM dashboard sans rechargement manuel. Tester les 4 cas : interested, neutral, not_interested, opt_out.
- [ ] Dashboard CRM enrichi :
  - Colonne Score (scoring/10) + colonne Intent (interested/neutral/not_interested/opt_out) avec badge couleur
  - Tooltip sur scoring_justification (pourquoi ce score)
  - conversation_summary visible en sous-ligne ou tooltip (resume de l'echange)
  - Dernier message IA envoye : afficher le contenu du dernier message outbound dans la ligne CRM (lecture depuis lk_messages direction=outbound)
  - Badge warning rouge "IA arretee" quand ai_enabled=false sur un prospect, avec la raison (opt_out, score trop bas, message_count depasse seuil, desactive manuellement)
  - Bouton "Reprendre la main" sur les prospects avec IA arretee : ouvre directement la conversation + invite le client a repondre manuellement
  - Reflexion a mener avec Geoffrey : seuil de score en dessous duquel le client est notifie pour intervenir manuellement (ex score <= 3 apres 3 echanges -> alerte + suggestion de message humain)

## Priorites court terme (au 19/06/2026)

0. Relances (Feature dashboard livree le 19/06) : cabler le cron n8n cote Anthony (contrat ci-dessus, Feature 2). Verifier d'abord si un WF n8n lit encore `lk_relance_templates` / `relance_N_template_id` avant le nettoyage DB.
1. Agent intent / scoring (Feature 3) : EN PAUSE (decision 19/06). Quand reprise : migration conversation_summary + node Claude dans WF Conversation + affichage CRM
2. Corriger les 3 bugs bloquants du WF Scrapping (Marquer invite sans filtre, double Flatten, branches sans Respond) avant d'utiliser l'auto-invite
3. Blocage conversation longue : si message_count >= seuil (ex 10), couper l'IA automatiquement (ai_enabled=false sur le prospect) + notifier le client dans le dashboard (badge ou alerte). Evite les boucles IA-IA infinies. Seuil configurable dans lk_clients_config ou fixe en dur dans n8n.
4. Garde-fou emoji/reaction : dans le WF Conversation, avant l'appel Claude, detecter si le message recu est une reaction emoji seule (pouce, coeur, etc.) ou un message tres court sans texte reel -> ne pas repondre, laisser processing_status=idle. Unipile renvoie parfois des reactions LinkedIn comme messages entrants.
5. Workflow "Invitation recue" (role intent) : accepte auto + 1er message IA quand quelqu'un envoie une invitation
6. Relance Icebreaker : 2e message si pas de reponse apres X jours (nb_relance=0, last_message_sent_at < now-Xj)
