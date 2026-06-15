# Logbook — Dashboard Kaizen

Journal chronologique des sessions de travail. Le plus recent en haut.
Pour la vue d'ensemble par phases, voir [ROADMAP.md](./ROADMAP.md).

---

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
