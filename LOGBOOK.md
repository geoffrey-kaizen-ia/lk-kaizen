# Logbook — Dashboard Kaizen

Journal chronologique des sessions de travail. Le plus recent en haut.
Pour la vue d'ensemble par phases, voir [ROADMAP.md](./ROADMAP.md).

---

## 2026-06-17 (suite 4 — CRM drawer + tri colonnes + agent intent)

### CRM /dashboard/pipeline — enrichissements

- Ajout bouton bulle "Voir la conversation" sur chaque ligne du CRM : lien vers `/dashboard/conversations?prospect={id}`. ConversationsClient modifie pour lire le param URL et selectionner directement le bon prospect.
- Tri au clic sur les en-tetes de colonnes : Prospect, Statut, Msgs, IA, Derniere activite. Fleche indicatrice (asc/desc), deuxieme clic inverse, colonne inactive affiche ↕.
- Drawer prospect : clic sur une ligne ouvre un panneau lateral droit avec avatar, nom, lien LinkedIn, poste, entreprise, badge statut, indicateur IA, stats (messages/relances/derniere reponse/dernier envoi), intent_state si dispo, bouton "Voir la conversation" en footer.

### Priorisation et conception — agent intent / scoring

- Statut actuel clarifie : `interested` et `not_interested` ne sont jamais ecrits automatiquement aujourd'hui. Seuls `invited`, `connected`, `in_conversation` sont poses par n8n.
- Decision : agent intent = V1 prioritaire, prompt fixe Kaizen (non editable client), node Claude insere dans WF Conversation apres "Supabase - Message entrant" et avant "Code - Calcul timing".
- Prompt complet redige et note en session (scoring 1-10, scoring_justification, intent_state, reply_sentiment, conversation_summary). Code node Parse JSON inclus. Prêt a coller dans n8n.
- Migration a faire : ajouter colonne `conversation_summary text` sur `lk_prospects`.
- Nouvelles priorites notees en ROADMAP : blocage conversation longue (message_count >= seuil -> ai_enabled=false + alerte), garde-fou emoji/reaction LinkedIn (ne pas repondre a un pouce ou reaction seule).

### ROADMAP mise a jour

- Feature 2 CRM et Feature 3 Agent intent ajoutees. Priorites reordonnees au 17/06.
- Score cache du CRM note pour V2 (dependance agent intent).

## 2026-06-17 (suite 3 — memoire curseur pagination + push git)

### Connexion GitHub / Vercel verifiee + push

- Commit de tout le travail 16-17/06 non versionne (22 fichiers : droits par client, icebreaker template, settings cadence, page admin, RangeSlider, delayPresets) puis `git push origin main`.
- CONFIRME : le repo GitHub EST connecte au projet Vercel. Le push a declenche un build automatique en production (statut Building observe). L'angle mort note dans CLAUDE.md (push ne deploie pas) est leve.
- File d'attente messages : WF Conversation (noeud Calcul timing) ET WF Cron confirmes termines par Nicolas. ANTHROPIC_API_KEY changee/OK.

### Memoire de curseur de pagination (lk_searches) — IMPLEMENTEE

- Le workflow n8n "Scrapping" lit/ecrit desormais `lk_searches` pour reprendre la pagination Unipile au bon endroit a chaque relance d'une meme recherche.
- DECOUVERTE : le `cursor` Unipile est un simple base64 encodant `{ start, params }` (pas de session token, PAS d'expiration). Reprise fiable dans le temps.
- Nouveaux noeuds : `Code - Compute hash` (hash djb2 pur JS, module `crypto` interdit en sandbox n8n ; normalise keywords+location+network+industry), `HTTP - Lire curseur` (GET PostgREST, service_role, `alwaysOutputData`), `HTTP - Upsert lk_searches` (PATCH avec filtres account_id+query_hash), `Recherche epuisee` (IF sur `exhausted`) + `Reponse - Recherche epuisee` (Respond webhook).
- `Resolve location & build payload1` modifie : lit cfg depuis Compute hash + extrait last_cursor de la reponse Lire curseur. `Search profiles` : curseur passe en query param. `Supabase - Inserer resultats` passe en `continueErrorOutput` (doublons UNIQUE ignores ligne par ligne, comportement anti-doublon voulu).
- Dashboard : `launchSearch` lit la reponse n8n et affiche "Plus de profils disponibles..." si `exhausted`. Webhook passe en `responseMode: responseNode`.
- Pieges resolus : `crypto` interdit (djb2), anon key bloquait lecture+ecriture (RLS, passe service_role), filtre PostgREST sans prefixe `eq.`, `Lire curseur` sans filtre query_hash renvoyait toujours la 1re ligne (toutes les recherches paraissaient epuisees).
- Point ouvert : REVIEW du WF complet a releve 3 bugs bloquants PAS encore corriges -> (1) `Supabase - Marquer invite` branche auto-invite n'a AUCUN filtre = passe TOUTE la table en "invited", (2) connexion `HTTP - Upsert lk_searches -> Flatten` fait tourner Flatten/insert 2x, (3) webhook en responseNode mais branches recherche-normale et send_invitations sans noeud Respond = 500 cote dashboard. Mineurs : curseur envoye en double (body + query param), `exhausted` detecte avec 1 run de retard.

## 2026-06-17 (suite 2 — icebreaker UX refonte)

### Refonte UX card Icebreaker

- Card Icebreaker redessinee : les 3 cards (Icebreaker, Conversation, Invitation recues) restent cote a cote dans la grille `sm:grid-cols-3` (suppression du `col-span-full` precedent).
- Switcher "Agent IA / Message fixe" remplace par deux options radio empilees verticalement dans la card : cercle rempli = actif, badge "Actif" a droite, l'autre option est grisee.
- Mode Message fixe en accordeon : textarea + variables ne s'ouvrent que quand l'option est cochee.
- Explication des variables enrichie dans l'accordeon : `{{first_name}}` (prenom, ex : Marie) + `{{last_name}}` (nom, ex : Dupont) + note "Kaizen remplace ces variables par les vraies infos du prospect au moment de l'envoi".
- Boutons d'insertion rapide `+ {{first_name}}` / `+ {{last_name}}` conserves, insèrent a la position du curseur.
- Indicateur de changements non sauves : bouton "Enregistrer les modifications" passe en orange (warning) quand le texte du template est modifie sans avoir ete sauvegarde.
- Typecheck TypeScript OK.

## 2026-06-17 (suite — icebreaker template mode)

### Icebreaker : mode message fixe

- MIGRATION `add_icebreaker_template_mode` : colonnes `icebreaker_mode text DEFAULT 'ai'` (CHECK ai/template) + `icebreaker_template text` ajoutees a `lk_clients_config`.
- MIGRATION `add_icebreaker_enabled` : colonne `icebreaker_enabled boolean DEFAULT true` ajoutee a `lk_clients_config` (toggle independant du role assignment).
- BUG CORRIGE : `updateCadenceSettings` utilisait `.upsert()` -> RLS bloquait (INSERT policy evaluee meme en mode UPDATE). Remplace par `.update().eq("user_id")`.
- Config icebreaker deplacee de `/dashboard/settings` vers `/dashboard/agents` (decision UX : c est la config d un role, pas un reglage de cadence).
- Carte Icebreaker redessinee dans AgentsClient : toggle on/off (sur `icebreaker_enabled`, independant de l assignation agent) + switcher "Agent IA / Message fixe" + textarea avec chips variables (`{{first_name}}`, `{{last_name}}`) + bouton Enregistrer dedie.
- Nouvelles server actions dans `agents/actions.ts` : `updateIcebreakerConfig` + `toggleIcebreakerEnabled`.
- Variables UI reduites a `{{first_name}}` et `{{last_name}}` (company et job_title retires : non disponibles dans le JSON Unipile UserProfile de base).
- n8n Icebreaker — formule de substitution template : `{{ $json.icebreaker_template.replace(/\{\{first_name\}\}/g, ...).replace(/\{\{last_name\}\}/g, ...) }}` (regex pour eviter le conflit avec la syntaxe `{{ }}` de n8n).
- n8n Icebreaker — formule delai humanise : `{{ Math.floor(Math.random() * (max - min + 1)) + min }}` avec min/max lus depuis `Supabase - Config client`.
- n8n — architecture branche template : Edit Fields (substitution) -> meme Wait node que la branche Claude (pas de Merge node necessaire, n8n traite la branche active).

## 2026-06-17

### Code review + corrections page /dashboard/settings

- Code review sur les fichiers settings (SettingsClient, actions, delayPresets, RangeSlider, page).
- BUG CORRIGE : `updateCadenceSettings` utilisait `.update().eq("user_id")` -> UPDATE silencieux (0 lignes, pas d'erreur) quand la ligne `lk_clients_config` n'existe pas encore. Remplacé par `.upsert({ ...fields, user_id }, { onConflict: "user_id" })` -> la ligne est créée si absente.
- BUG CORRIGE : `TIMEZONES` (SettingsClient) et `ALLOWED_TIMEZONES` (actions) étaient deux listes identiques indépendantes. Centralisées dans `delayPresets.ts` (`ALLOWED_TIMEZONES as const`), importées dans les deux fichiers.
- BUG CORRIGE : `SOCLE_MAX_INVITE_LIMIT = 25` et `SOCLE_MAX_MESSAGE_LIMIT = 40` étaient dupliqués dans SettingsClient et actions. Déplacés dans `delayPresets.ts`, supprimés des anciens fichiers.
- Bonus : `useState` du mode de délai utilise désormais `isDelayMode()` (déjà importé) au lieu de réimplémenter le même guard inline.
- Typecheck `npx tsc --noEmit` : OK.

### Bug badge "LinkedIn offline" pour Geoffrey (admin)

- Diagnostic root cause : la policy RLS `admin_read_all_clients` (Geoffrey lit toutes les fiches `lk_clients_config`) faisait remonter 3 lignes, `.maybeSingle()` retournait null -> badge toujours "offline" + fallback `ai_enabled=true` masquait le bug.
- Suppression du call API Unipile dans `layout.tsx` (check statut devenu `account_id && is_active` en base, aucune requete externe).
- Ajout filtre `.eq("user_id", user.id)` sur toutes les requetes `.maybeSingle()` sur `lk_clients_config` : `layout.tsx`, `settings/page.tsx`, `agents/actions.ts` (getAccountId), `prospects/actions.ts` (getAccountId), `agents/page.tsx`.
- Règle documentée en mémoire projet : toute requête single sur `lk_clients_config` doit filtrer user_id.

### Système de droits et feature flags par client

- Décision architecture : deux axes distincts — droits admin (forfait, colonne `allowed_roles` protégée) + préférence client (toggle `is_enabled` dans `lk_agent_assignments`).
- MIGRATION `add_role_entitlement_and_toggle` : `lk_clients_config.allowed_roles text[]` (def `{icebreaker,conversation,intent}`, `REVOKE UPDATE` pour les clients) + `lk_agent_assignments.is_enabled boolean` (def true).
- MIGRATION `admin_features_and_rls` : colonne `can_edit_prompt boolean` (def false, protégée par REVOKE) + RLS policy "admin lit toutes les fiches" pour geoffrey@kaizenia.fr + 2 fonctions `SECURITY DEFINER` (`admin_set_allowed_roles`, `admin_set_can_edit_prompt`) — aucune service_role key dans le code.
- Page `/dashboard/admin` créée : liste tous les clients avec toggles rôles (icebreaker / conversation / invitation reçue) + toggle "Ecriture de prompt libre". Redirige si non-admin.
- Lien "Admin" ajouté dans la sidebar, visible uniquement pour geoffrey@kaizenia.fr.
- Page `/dashboard/agents` : cartes rôles ont désormais 3 états (verrouillé forfait / toggle OFF / actif). Champ Prompt et bouton "agent vierge" cachés si `can_edit_prompt = false`.
- Server action `toggleRoleEnabled` ajoutée dans agents/actions.ts.
- n8n Conversation : 2 IF nodes ajoutés — `$json.allowed_roles.includes('conversation')` (Boolean) après Supabase Config client + `is_enabled` (Boolean) après Supabase prompt conversation.

---

## 2026-06-16 (suite — file d'attente messages)

- Architecture file d'attente messages décidée et commencée : tout passe par `lk_prospects` (pas de nouvelle table). Un seul chemin d'envoi, le WF Cron finit le travail.
- MIGRATION APPLIQUEE (omwmbqpbwprpaqaphphg, `add_pending_reply_to_lk_prospects`) : ajout colonne `pending_reply text` sur `lk_prospects` (nullable, vide = rien en attente).
- Architecture des deux workflows définie :
  - WF Conversation (à modifier) : après Code-Extraire → garde Supabase Message entrant + ajoute Code Calcul timing (scheduled_send_at avec recalage créneau) + modifie Supabase Update prospect (écrit pending_reply + scheduled_send_at) → STOP. Supprime : Unipile Envoyer + Supabase Message sortant.
  - WF Cron (à finir, déjà commencé par Nicolas) : Schedule → SB Get Many Rows (scheduled_send_at <= now, ai_enabled=true, pending_reply not null) → IF → Unipile Envoyer → SB Message sortant → SB Update prospect (remet pending_reply={{ null }}, scheduled_send_at={{ null }}).
- Cas double message analysé : l'overwrite de pending_reply est le comportement correct (le 2e run lit toute l'historique Unipile, génère une réponse qui couvre les deux messages, écrase la 1re réponse en attente).
- Bugs n8n rencontrés et résolus : IF attendait un booléen sur pending_reply (fix : condition "is not empty") ; prospect_id dans SB Message sortant mappé sur linkedin_id au lieu du UUID Supabase (fix : `{{ $('Supabase - Prospect').item.json.id }}`).
- Point ouvert : nœud "Code - Calcul timing" pas encore écrit (calcule scheduled_send_at avec tirage aléatoire dans [delay_min, delay_max] + recalage sur prochain créneau active_hours/active_days/timezone lus depuis Supabase - Config client, déjà présent dans le WF).

## 2026-06-16

- Délais de réponse, cadences visuelles et créneaux horaires sur `/dashboard/settings`.
- MIGRATION APPLIQUEE en base (projet omwmbqpbwprpaqaphphg, `add_delay_bounds_active_hours_queue`) :
  - `lk_clients_config` : ajout de `response_delay_min_minutes` (def 30), `response_delay_max_minutes` (def 45), `active_hours_start` (def 9), `active_hours_end` (def 19), `active_days int[]` (def {1,2,3,4,5}), `timezone` (def Europe/Paris).
  - `lk_prospects` : ajout de `scheduled_send_at timestamptz` (file d'attente, écrit par n8n).
  - Vérifié : policy RLS UPDATE de `lk_clients_config` (`user_id = auth.uid()`) couvre les nouvelles colonnes, pas de policy par colonne à ajouter.
- UI : presets de délai désormais traduits en minutes (rapide=5-15, normal=30-45, lent=60-120), source de vérité partagée `src/app/dashboard/settings/delayPresets.ts` (importée par SettingsClient ET actions, le serveur recalcule min/max depuis le mode, ne fait pas confiance au client). Cadences invitations/messages transformées en sliders (`RangeSlider.tsx`, range natif stylé, track rempli) plafonnés au socle 25/40. Nouvelle section "Créneaux de réponse" : plage horaire (selects 0-23), boutons jours actifs (L M M J V S D), select fuseau (liste blanche de 5 fuseaux).
- `actions.ts` : validation des nouveaux champs (bornes minutes via preset, heures 0-23 début<fin, ≥1 jour actif, fuseau en liste blanche), update élargi. `page.tsx` : select et props étendus avec défauts.
- Contrat n8n documenté dans CLAUDE.md (section pipeline n8n) : tirage aléatoire dans [min,max], recalage sur prochain créneau ouvert via active_hours/active_days/timezone, écriture de scheduled_send_at + cron qui scanne les lignes dues. RIEN n'est encore câblé côté n8n (en pause, ROADMAP 5.1). Typecheck OK.

## 2026-06-15 (suite 5)

- Workflow n8n "Scrapping" : fix du schema Unipile classic/people sur les filtres de ciblage. L'API `/linkedin/search` (classic, category people) n'accepte `industry` que comme tableau plat d'IDs (include uniquement, pas d'exclusion) et n'a AUCUN champ `role`/exclusion de poste (ca n'existe que sur l'API Recruiter, hors V1). Nodes "Resolve location & build payload1" et "Flatten + metadata1" corriges en consequence. Confirme fonctionnel par Nicolas ("ok ca passe").
- DECOUVERTE IMPORTANTE : l'API classic/people ne renvoie JAMAIS `industry` (toujours null) et n'a pas de champ entreprise dans sa reponse. La "decouverte" du 15/06 (LOT 2) annoncant le contraire etait incorrecte. Consequences :
  - Champ "Sauf dans ce secteur" (`exclude_industry`) retire de `/dashboard/prospects` (ProspectsClient.tsx) et du payload envoye a n8n (actions.ts) : c'etait un no-op permanent.
  - `current_company` est desormais extrait au mieux depuis le `headline` du profil via regex (`chez|at|@ ...`) dans le node "Flatten + metadata1". `industry` reste mappe a `null` (documente dans le code).
  - Le champ "Dans quel secteur ?" (`industry`, include-only) est conserve, toujours envoye a n8n.
- Strategie anti-doublons sur les recherches repetees : discutee, version "Complete" choisie par Nicolas (UNIQUE constraint + anti-join pipeline + memoire de curseur). DEUX MIGRATIONS APPLIQUEES en base (projet omwmbqpbwprpaqaphphg) :
  - `dedup_lk_search_results_unique_provider` : nettoyage des doublons existants + contrainte `UNIQUE (account_id, provider_id)` sur `lk_search_results` (lk_search_results_account_provider_uniq). Effet immediat, evite deja les doublons d'insertion.
  - `create_lk_searches_cursor_memory` : nouvelle table `lk_searches` (account_id, query_hash, query_params, last_cursor, last_run_at, exhausted) + RLS, prete pour la memoire de curseur mais PAS ENCORE UTILISEE.
  - MIS EN PAUSE par Nicolas ("trop complexe, faut que je reflechisse") : le cablage n8n (8 nodes : query_hash, lecture/ecriture curseur, anti-join sur les IDs existants, reprise de pagination) est concu mais pas implemente. A reprendre quand Nicolas est pret. La contrainte UNIQUE reste active dans tous les cas ; la table `lk_searches` est inerte en attendant.

## 2026-06-15 (suite 4)

- BUG CORRIGE : le chemin "agent vierge (avance)" du wizard perdait le type choisi (agentType) car handleWizardCreate ouvrait directement le formulaire libre sans transmettre knowledge_base, et handleSubmit ne l'incluait pas dans le FormData -> knowledge_base restait null en base, donc aucun badge ni filtrage (cas reel de Nicolas : "Agent 1" / objectif RDV, account_id BY85po44SUyPqFR8pbrm0Q, cree via ce chemin).
  - AgentsClient : nouvel etat pendingAgentType, capture le type choisi dans le wizard avant d'ouvrir le formulaire libre.
  - Correctif retroactif applique en base sur l'agent existant "Agent 1" (knowledge_base = {"agentType":"conversation"}) pour qu'il affiche directement l'icone "Conversation".
- Le badge texte "Conversation / Icebreaker - premier message / Invitation recue - premier message" est remplace par un petit logo colore (meme icone que dans le bandeau "Comprendre les agents") affiche a cote du nom de l'agent (AGENT_TYPE_ICON).
- Nouveau champ "Type d'agent" (select : Non defini / Conversation / Icebreaker / Invitation recue) dans le formulaire de creation/edition d'agent. A l'edition, permet de corriger le type d'un agent (knowledge_base.agentType mis a jour, le reste de knowledge_base est preserve). updateAgent (actions.ts) ecrit desormais aussi knowledge_base.
  - Typecheck OK.

## 2026-06-15 (suite 3)

- Ajustements suite a test live de Nicolas (creation d'un agent conversationnel via le nouveau wizard) :
  - Retrait du texte explicatif redondant sous chaque role dans "Roles actifs" (l'explication complete est deja dans le bandeau "Comprendre les agents").
  - Badge de type d'agent generalise sur chaque carte de /dashboard/agents : "Conversation" (vert), "Icebreaker - premier message" (bleu), "Invitation recue - premier message" (orange), base sur knowledge_base.agentType. Les agents sans type (crees avant ce chantier) n'ont pas de badge.
  - Les selecteurs de "Roles actifs" filtrent desormais les agents proposes selon leur type : un agent conversationnel n'apparait plus dans les selecteurs Icebreaker/Invitation recue et inversement (agentsCompatibleWithRole). Les agents sans type (legacy) restent proposes partout, faute de classification.
  - Typecheck OK.

## 2026-06-15 (suite 2)

- Clarification des 3 types d'agents (Conversation / Icebreaker / Invitation recue) sur /dashboard/agents :
  - Nouveau bandeau "Comprendre les agents" en haut de la page qui explique a quoi sert chaque role (les agents Icebreaker et Invitation recue envoient UN SEUL message automatique, l'agent Conversation gere toute la discussion). Decision : le role "intent" existant est reutilise pour "Invitation recue" (pas de migration de schema, l'ancien usage "agent d'analyse" etait deja en pause cote roadmap).
  - AgentWizard : nouvelle premiere etape "Quel type d'agent veux-tu creer ?" (Conversation / Icebreaker / Invitation recue). Les types "premier message" (icebreaker, invitation recue) ont un formulaire court dedie (identite, contexte business, ton/style, instructions) et un nouveau gabarit de prompt (firstMessageTemplate.ts, buildFirstMessagePromptContent) different du gabarit conversationnel (promptTemplate.ts) : objectif unique = obtenir une reponse / remercier, jamais de pitch/lien/prix/RDV. Le type choisi est stocke dans knowledge_base.agentType.
  - AgentsClient : badge "Premier message" sur les agents de type icebreaker/invitation_recue (detection via knowledge_base.agentType, avec repli sur le role assigne pour les agents crees avant ce chantier).
  - Nouveau mode test pour les agents "premier message" (TestFirstMessageModal) : au lieu du chat, on saisit un profil de prospect simule (prenom/headline/resume), et l'agent genere LE message qu'il envoyerait, via une nouvelle server action testFirstMessage qui reproduit le gabarit du node "Claude - Icebreaker" du workflow n8n Icebreaker (0yQOYs1Ffiqtj4IX).
  - Typecheck (npx tsc --noEmit) OK.

## 2026-06-15 (suite)

- Feature 1 (handover manuel) : ajout du bouton "Profil LinkedIn" (lien linkedin_url, deja en base) et du descriptif (occupation) sous le nom du prospect dans /dashboard/conversations. Le toggle desactivation IA par prospect existait deja.
- Bouton "Profil LinkedIn" restyle en bleu LinkedIn avec effet de relief (degrade + ombre + highlight).
- Ajout d'un ecran "moulinette" (spinner + messages qui defilent, ~2.4s) entre "Generer le prompt" et la preview dans AgentWizard, pour donner l'impression que le prompt est compile/reflechi plutot que genere instantanement.
- Feature 2 (mode test agent) : inspection du workflow n8n "Kaizen - Conversation LinkedIn" (fsSw8bIknV1cAgKx), node "Claude - Reponse" = appel Anthropic claude-sonnet-4-6 simple (system=prompt_content, message utilisateur = historique + dernier message + infos prospect + nb echanges). Implementation : bouton "Tester" sur chaque agent de /dashboard/agents -> TestAgentModal (chat ephemere, profil prospect simule editable) -> server action testAgentReply (actions.ts) qui appelle l'API Anthropic avec le meme gabarit. Package @anthropic-ai/sdk installe. Variable ANTHROPIC_API_KEY ajoutee a .env.local et .env.local.example (Nicolas doit la renseigner).

## 2026-06-15

- Reunion de roadmapping : 6 features decidees (handover manuel + redirection profil LinkedIn, mode test agent, crash test automatise, onboarding enrichi avec ciblage + identite agent, limite/file d'attente messages, mode preview profils). Strategie etablie : fermer les bloquants existants (LOT 0/1) avant d'empiler, lever en premier l'inconnue Unipile (LOT 2) qui debloque ciblage et preview.
- LOT 0 termine par Nicolas : webhooks doublons Geoffrey nettoyes, contrainte UNIQUE (account_id, linkedin_id) + upsert sur Icebreaker #2, Anthony relie manuellement.
- LOT 2 (inconnue Unipile) leve : l'API `/linkedin/search` (classic, category people) filtre nativement par `industry` (include/exclude via IDs resolus sur `/search/parameters?type=INDUSTRY`) et par `role` (exclusion de titres avec `priority: DOESNT_HAVE`). Taille d'entreprise = filtre Sales Navigator uniquement, hors perimetre V1. Les resultats de recherche contiennent deja secteur/entreprise/poste -> le mode preview (Feature 6) ne coute aucun scraping supplementaire, il reutilise les memes donnees.
- DECOUVERTE : le webhook n8n "prospect-search" attendu par `/dashboard/prospects` existait deja (workflow "Scrapping", `/webhook/Scrapping`), le point ROADMAP "EN ATTENTE" etait obsolete. Workflow analyse : Init config recherche -> Resolve location & build payload -> Search profiles (Unipile) -> Flatten + metadata -> Supabase insert -> Auto invite si demande.
- Demarrage Feature 4/6 (ciblage + preview) :
  - Migration `add_industry_company_to_lk_search_results` appliquee sur Supabase (colonnes `industry`, `current_company` sur `lk_search_results`).
  - Formulaire `/dashboard/prospects` enrichi : nouveaux champs "Dans quel secteur ?", "Sauf dans ce secteur", "Postes a eviter". Libelles et aides reformules pour utilisateurs non techniques ("Qui cherches-tu ?", "Ou se trouvent-elles ?", etc.).
  - Validation du champ "Combien de profils ?" : entre 1 et 50, message d'erreur si hors limites, vide = 50 par defaut.
  - Nouveau bouton "Ignorer la selection" pour ecarter en masse les profils selectionnes (server action `ignoreSelectedIds`).
  - `launchSearch` envoie desormais `industry`, `exclude_industry`, `exclude_titles` dans le payload vers le webhook n8n.
  - Code complet fourni pour adapter les 3 nodes n8n du workflow "Scrapping" (Init config recherche, Resolve location & build payload1, Flatten + metadata1) : a coller par Nicolas, plus verification des noms reels de champs industry/current_company dans la reponse Unipile.

## 2026-06-12

- Audit de l'interface dashboard vs referentiel architecture-cible (9 blocs) : socle existant correct (kill switch global + par prospect, stats/cohortes), mais aucune UI pour la fiche produit/knowledge_base (Bloc B), aucun journal d'audit visible (Bloc H), aucune exclusion CRM (Bloc C).
- Chantier Cadence (Bloc E) demarre : ajout des colonnes daily_invite_limit (def. 25), daily_message_limit (def. 40), response_delay_mode (def. normal) sur lk_clients_config, plus nouvelle page /dashboard/settings (cadence + delai de reponse, bornee par les plafonds socle). Entree "Reglages" ajoutee a la sidebar.
- IMPORTANT : ces plafonds ne sont pour l'instant que cote base/UI, AUCUN workflow n8n ne les lit encore (ni Icebreaker, ni Conversation, ni le futur wf d'invitations sortantes d'Anthony a synchroniser). A brancher plus tard.
- Migration de la base Supabase vers le compte Geoffrey : acces verifie, projet KaizenIA (omwmbqpbwprpaqaphphg) actif et healthy, tables lk_* intactes avec RLS.
- Nouvelle table crm_contacts (3900 lignes, migree depuis Airtable) presente sur le compte mais hors perimetre pour l'instant.
- Creation de ROADMAP.md et LOGBOOK.md pour suivre l'avancement du projet.
- Chantier compteur de cadence (limite quotidienne de messages dans le workflow Conversation) mis en pause en cours de route, plan complet documente dans ROADMAP.md (Phase 5.1) pour reprise ulterieure.
- Nouveau chantier "Nouveaux prospects" lance, basant sur le workflow de recherche LinkedIn (Unipile) d'Anthony : table lk_search_results creee, page /dashboard/prospects (formulaire de recherche mots-cles/localisation/distance reseau/nb max + liste de resultats avec selection manuelle ou envoi auto des invitations), entree sidebar ajoutee. Reste a creer le webhook n8n "prospect-search" (recherche + ecriture des resultats + gestion des invitations).
- Gros check complet du projet (code + base + docs) :
  - Phase 2 en realite TERMINEE (CRUD agents + wizard + assignations), la roadmap initiale la croyait non commencee.
  - Pages /dashboard/conversations et /dashboard/stats deja construites, kill switch IA global dans la sidebar.
  - connectLinkedin envoie deja user_id a n8n (point que la roadmap marquait a faire).
  - Signup ne cree toujours PAS la ligne lk_clients_config (chantier onboarding confirme). Anthony toujours pas relie.
  - BUG TROUVE : lk_prospects a deux colonnes jumelles ia_active ET ai_enabled. Le dashboard ecrit ai_enabled (1 prospect deja en pause), le garde-fou n8n lirait ia_active (toutes a true) -> le bouton pause IA serait sans effet. A unifier en priorite.
  - RLS verifie sain : policies par account_id via lk_clients_config, UPDATE limite a ai_enabled sur lk_prospects.
- Integration du challenge d'architecture de Geoffrey : creation de docs/architecture-cible.md (4 couches : policy engine, socle, config compilee, boucle d'apprentissage + referentiel V1/V2 + harness d'eval) et ajout de la Phase 5 dans la roadmap.
- CLAUDE.md remis a jour : statut des phases, colonnes reelles, point ouvert ia_active/ai_enabled, references aux docs de pilotage.
- BUG IA_ACTIVE/AI_ENABLED CORRIGE : Nicolas a modifie le node If du workflow n8n Conversation (fsSw8bIknV1cAgKx) pour lire ai_enabled au lieu de ia_active. Cote base : Geoffrey Cuberos remis a ia_active=false pour coherence, puis colonne ia_active droppee de lk_prospects. Le bouton pause IA du dashboard est desormais effectif.
- Verification du branchement icebreaker via l'API Unipile (liste des webhooks) :
  - lk_agent_assignments : icebreaker assigne pour Nicolas (Agent 2) et Anthony (Icebreaker Anthony), tous deux actifs avec prompt. Geoffrey n'a PAS d'icebreaker assigne.
  - Webhooks Unipile new_relation + message_received bien configures et actifs, account_ids=[] (tous comptes) -> kaizen-new-relation et kaizen-message-recu pointent vers les bons workflows n8n.
  - DECOUVERTE : 2 webhooks doublons specifiques au compte de Geoffrey Cuberos (Geoffrey - New Relation LinkedIn + Geoffrey_LinkedIn_message_entrant), pointant vers d'anciennes URLs n8n differentes. Risque de double declenchement (icebreaker/reponse en double) pour ses prospects si ces vieux workflows sont encore actifs. Decision de Nicolas : ne rien faire pour l'instant, point note dans la roadmap a nettoyer plus tard.

## 2026-06-10

- Workflow n8n "Kaizen - Conversation LinkedIn" (fsSw8bIknV1cAgKx) : 3 bugs corriges a la main par Nicolas dans l'editeur n8n.
  - Crash sur node "Code - Parse intent" inexistant -> prospects bloques en processing_status='processing' (Anthony MAGDU + Geoffrey Cuberos debloques par UPDATE manuel).
  - Node "Supabase - Message sortant" lisait le mauvais payload -> dedoublonnait le message entrant dans l'historique.
  - sent_at desormais explicite (timestamp Unipile pour l'entrant, now() pour le sortant).
  - Garde-fou durci : rejet des events account_type=WHATSAPP + message non vide.
- Decision : analyse "intent" (3e role agent) reportee. Le node final ne fait que mettre a jour last_reply_at, message_count, processing_status=idle.
- A tester : envoyer un vrai message LinkedIn et verifier l'ordre inbound/outbound en base + dashboard.

## 2026-06-09 / 2026-06-10 (architecture agents)

- Nouvelle architecture des agents conversationnels definie : la strategie vit dans prompt_content (lk_agents), pas dans des regles n8n.
- 3 roles definis : icebreaker, conversation, intent (lk_agent_assignments).
- Workflows n8n crees : Icebreaker (0yQOYs1Ffiqtj4IX), Conversation (fsSw8bIknV1cAgKx).
- Colonnes de controle ajoutees a lk_prospects : ia_active, processing_status, profile_summary, occupation, job_title, company_name, scoring, scoring_justification, intent_state, reply_sentiment, nb_relance, last_message_sent_at, last_reply_at...
- Agents de Nicolas seedes avec de vrais prompts (icebreaker/conversation/intent). Anthony et Geoffrey ont encore des prompts placeholder.
- account_id Unipile de Nicolas mis a jour : fhBcmJdARp2_Du62_6F1xg (l'ancien DHmKsuGuSwuJcsRjYV77qg est perime).
- Reste a faire : configurer les webhooks Unipile vers n8n, verifier endpoints profil/posts, brancher credentials HTTP, test bout en bout.

## 2026-06-08

- Phase 1 livree et validee de bout en bout : scaffold Next.js + Tailwind v4 + Supabase (@supabase/ssr), pages /login /signup, middleware de protection /dashboard, page /dashboard/agents (lecture lk_agents sous RLS).
- Pieges notes : middleware doit etre dans src/middleware.ts si dossier src/ ; Next monte en ^15.5.19 (CVE-2025-66478) ; emails @example.com rejetes par Supabase (utiliser gmail.com) ; confirmation email desactivee pour le dev (a reactiver en prod).
- Flux "Connecter LinkedIn" cable et teste : bouton dashboard -> server action connectLinkedin -> webhook n8n N8N_UNIPILE_CONNECT_URL -> Unipile -> redirection hosted auth.
- Bug n8n corrige : expiresOn doit etre en UTC strict (.toUTC().toISO()).
- Lien user_id <-> lk_clients_config verifie bloquant pour RLS. Geoffrey relie manuellement, Anthony reste a relier.
- Statut LinkedIn actuellement base sur is_active (temporaire, angle mort connu : client actif jamais connecte = badge vert quand meme). A remplacer par linkedin_status + last_connected_at alimentes par webhook Unipile.
