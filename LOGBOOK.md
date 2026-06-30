# Logbook — Dashboard Kaizen

Journal chronologique des sessions de travail. Le plus recent en haut.
Pour la vue d'ensemble par phases, voir [ROADMAP.md](./ROADMAP.md).

## 2026-06-30 — Scission du workflow Icebreaker en deux (n8n) + documentation

### Icebreaker découpé : détection vs envoi
- Nicolas a scindé l'Icebreaker unique en deux workflows n8n, pour garder un log d'exécutions lisible (le schedule sur les minutes noyait le journal des invitations acceptées).
- `0yQOYs1Ffiqtj4IX` (garde l'ID, renommé "Invitation acceptée") : webhook `unipile-new-relation`, génère l'icebreaker (Claude) et crée le prospect avec le texte en attente. N'envoie plus.
- NOUVEAU `HdUkHiDzT9gpTvgV` "Schedule envoie message" : scheduleTrigger sur les minutes, pioche les prospects prêts, dédup chat, envoie via Unipile, écrit `lk_messages`, passe en `in_conversation`.
- Contrat de liaison établi (pas d'appel direct, tout passe par la base) : prospect prêt = `lk_prospects.status=connected` + `pending_reply` rempli + `scheduled_send_at` échu ; après envoi ces 2 champs sont vidés et le statut passe à `in_conversation`. Gate d'envoi `If2` (`ai_enabled` ET `icebreaker_enabled`) désormais dans le WF d'envoi.

### Documentation
- Exports sanitizés versionnés : `docs/n8n/icebreaker-invitation.json` + `icebreaker-message.json` (clés Unipile caviardées, aucun JWT/service_role résiduel). Ancien `icebreaker.json` supprimé.
- `docs/n8n/README.md` : 1 ligne Icebreaker → 2 lignes + nouvelle section « Icebreaker scindé en deux » (rôles + contrat de liaison). `sanitize.mjs` : slugs stables pour les 2 IDs. Exports périmés du 29/06 déplacés dans `.n8n-raw/_stale/`.
- Point ouvert : confirmer l'intervalle réel du `Schedule Trigger` (l'export n'a pas de valeur explicite → 1 min par défaut côté n8n ; Nicolas évoque 5 min). À vérifier dans l'UI puis préciser la doc.
- Constaté (en dur côté n8n) : la clé Unipile `X-API-KEY` du WF d'envoi est tapée en dur, pas en credential → rejoint le chantier rotation déjà ouvert.

### Clôture dossier icebreaker (revue des exports avec Nicolas)
- Vérifié dans `docs/n8n/icebreaker-message.json` (`HdUkHiDzT9gpTvgV`) que les 2 garde-fous sont bien câblés et à jour : (1) anti-doublon via `Unipile - Chats du compte` → `Deja un chat ?` → `déja contacté` (skip si chat existant) ; (2) `Update Prospect` (branche envoi) filtré par `id eq {{ Loop Over Items.id }}` → ne met à jour qu'UNE ligne (avant : pas de filtre sur l'id, il mettait plusieurs prospects à jour d'un coup) + écrit le vrai `chat_id` du retour Unipile.
- **Dossier icebreaker (anti-doublon + update unitaire) clôturé** côté code/docs. Reste un nettoyage mineur côté Nicolas : re-test Anthony + suppression fiche test (id `3062d60e-…`).
- Distinction reposée (pour ne pas confondre) : le mismark multi-tenant du CRON d'invitations (`Marquer invite` encore par `account_id+provider_id` dans l'export, pas par `id`) est un point ouvert DISTINCT, non bloquant tant qu'on reste en validation manuelle. Reste tracé en Phase 4 (bugs WF Scrapping).

### Corrections wizard agents (retours spontanés Geoffrey) — commit `6b6f43c`, poussé/déployé
- Champs obligatoires : le bouton "Suivant"/"Créer l'agent" était simplement grisé sans explication ("je clique, rien ne se passe"). Désormais cliquable + **bandeau rouge** listant nommément les champs manquants, sur les 2 formulaires (conversationnel ET prise de contact). Sur le bouton final, renvoi automatique vers la première étape incomplète. (`AgentWizard.tsx`)
- Fenêtre de test : la croix ✕ remplacée par un bouton texte explicite **"← Revenir à la création de l'agent"** (depuis le wizard) / "← Fermer" (depuis la liste des agents). Corrige le sentiment de blocage dans la modale de test. (`TestAgentModal.tsx`, `TestFirstMessageModal.tsx`)
- Test de l'agent conversationnel : ajout du bloc **"Charger un vrai profil"** (URL LinkedIn → remplit Poste depuis le headline, Résumé depuis l'à-propos via `scrapeLinkedInProfile`), comme en mode prise de contact. (`TestAgentModal.tsx`)
- Validé `tsc --noEmit` OK + testé en live par Nicolas (les 3 points OK) avant commit. ESLint non configuré sur le projet → le build Vercel ne bloque pas dessus, tsc reste le garde-fou. Commit ciblé sur les 3 fichiers ; autres changements en cours (n8n/docs) laissés intacts.

## 2026-06-29 — Audit builder agents vs 24 questions Geoffrey (méta-prompt + base de connaissance)

### Finitions wording audit Geoffrey (vague 2) + commits poussés
- Vague de corrections du rapport Geoffrey (P0/P1/P2) committée et poussée sur `main` (commit `87cddd1`, déployée). Résout le point ouvert "reste à committer la vague".
- 2e passe de finitions committée et poussée (commit `278015b`) : "LinkedIn online/offline" → "connecté/déconnecté" ; champs objectif unifiés sur les 2 types d'agent ("Ce que l'agent propose" + "Lien de ton objectif") ; entêtes de colonnes du CRM dé-capitalisés ; accent sur "Sélectionnez une conversation". tsc OK.
- Clarification (rien à corriger) : les "vous" restants sont des exemples de messages de l'agent AU prospect (l'agent vouvoie par défaut = correct) ; les descriptions d'interface tutoient déjà ("quand un prospect accepte ton invitation").
- Décision conservée : le menu Conversation reste cliquable quand son toggle est off (il faut choisir l'agent avant de pouvoir l'activer ; le bloquer casserait le flux).
- Bug invitations auto — diagnostic affiné avec l'output réel (12 lignes traitées venant de 3 campagnes / 2 comptes, dont 10 d'une campagne MANUELLE). FIX PRÉCIS confirmé (à appliquer par Nicolas, UI) : dans `Auto invite ?` ajouter 2 conditions AND (`search_id` = campagne courante + `status` = selected) ; dans `Supabase - Marquer invite` filtrer par `id`. Working tree propre, tout poussé.

### Diagnostic webhook Unipile `new_relation` (config OK, latence Unipile)
- Symptôme : invitation acceptée ne déclenchait pas l'icebreaker. Toute la chaîne vérifiée : webhook Unipile correct (`source: users`, `new_relation`, enabled, `account_ids=[]`), WF n8n actif, comptes en statut `OK`.
- Webhook prouvé fonctionnel : 4 appels `mode=webhook` traités à 12:42 (filtrés au node "Exclure compte test Geoffrey"). La nouvelle relation (Gilles, 14:11) déjà dans la liste Unipile mais event non émis.
- Cause : Unipile détecte les nouvelles relations sur un cycle de sync interne, pas en temps réel. Resync messages (`GET /accounts/:id/sync`) = mauvais levier (pas d'endpoint pour forcer la détection des relations). Surveillance 30 min : toujours rien.
- Point ouvert : si `new_relation` ne tombe pas sous quelques heures, à remonter au support Unipile.
- Constaté : le compte `1tGd_kZHRFCGb6-UUbilnw` (LinkedIn de Nicolas) est rattaché dans lk_clients_config à `djteks@gmail.com` (mode template) ; aucune ligne pour `nicolas@kaizenia.fr`. Mapping à clarifier.

### Garde-fou anti-doublon icebreaker (build n8n guidé, WF `0yQOYs1Ffiqtj4IX`)
- Objectif : ne pas envoyer l'icebreaker si une conversation existe déjà avec le prospect. Inséré sur la branche cron, avant le node d'envoi `Unipile - Envoyer icebreaker1`.
- 4 nodes : A `Unipile - Chats du compte` (GET `/chats` filtré account_id) ; B Code `Deja un chat ?` (match `attendee_provider_id` == `linkedin_id` → booléen `already_contacted`) ; C IF `Deja contacte ?` ; D Supabase `Update Prospect1` (branche skip : `status=in_conversation` + `processing_status=idle`).
- Câblage cible : C TRUE → D → Loop Over Items (skip, pas d'envoi) ; C FALSE → Envoyer icebreaker1.
- Piège corrigé sur D : ne jamais écrire de valeur vide dans une colonne `timestamptz` (`last_message_sent_at` / `scheduled_send_at`) → erreur Postgres ; gardé seulement `status` + `processing_status` (le changement de status suffit à sortir le prospect de la file).
- Testé : fiche prospect de test Anthony MAGDU créée (id `3062d60e-85f7-4cb0-9a94-a44ecbecb048`, compte Nicolas). Node B renvoie bien `already_contacted: true` une fois un chat existant.
- Incident test : armer la fiche (`scheduled_send_at` passé) alors que le garde-fou n'était pas câblé a déclenché un VRAI envoi du message de test à Anthony (chat créé) + fiche coincée en `processing`. Débloquée en base (`processing_status=idle`, `scheduled_send_at=null`).
- Point ouvert : finir le câblage C+D, re-tester Anthony (doit partir sur TRUE sans envoi), ré-exporter le WF (`.n8n-raw/` + `sanitize.mjs`), puis supprimer la fiche test Anthony.

### Plan de réponse à l'audit plateforme de Geoffrey
- Audit consolidé reçu (6 écrans + doctrine + relances + réactivation réseau + mode hard test). Vérifié écran par écran contre le code réel (4 explorations parallèles), pas de code modifié pour le plan lui-même.
- Constat : plateforme bien plus avancée que l'audit ne le suppose. Beaucoup de P0/P1/P2 déjà faits.
- Plan écrit dans [docs/audit-geoffrey-plan.md](./docs/audit-geoffrey-plan.md) : statut réel (fait/partiel/à faire) + faisabilité + propriétaire (dashboard / n8n guidé / base / décision Geoffrey), organisé en vagues.
- Décisions produit isolées pour Geoffrey : écart posts (injecter vs aligner exemples), réactivation réseau (report V2 + discours commercial), statut terminal "RDV pris", relances paramétrables par campagne.

### Corrections wording & cohérence dashboard (working tree, non committé, tsc OK)
- Wizard agent : astérisque "Preuves & résultats" rendu rouge (prop `required` sur `ListField`) ; exemple de ton aligné vouvoiement ; menu "Style d'écriture" dont les exemples s'adaptent au ton (tu → "t'as ?", vous → "vous avez ?") ; libellés "Style de message"/"Style de conversation" unifiés en "Style d'écriture".
- "Icebreaker" résiduel → "Prise de contact" (AgentsClient, 2 endroits visibles).
- TestAgentModal : "vos vrais prospects" → "tes" ; mot "prompt" masqué.
- Settings : curseur "invitations acceptées" → "envoyées" (c'est l'envoi qu'il plafonne) ; "warm-up" → "rodage".
- Statuts unifiés "En discussion" (CRM disait "En conversation") + tous accentués à l'identique (Invité/Connecté/Intéressé/Pas intéressé) sur Conversations + CRM.
- Stats : accents remis (Résultats, période, données, reçus/envoyés, Évolution, Détail, Début) + titres de section dé-capitalisés. Conversations + CRM : capitales/accents (Prospects, Tiède, Dernière activité). Prospects : "Objectif (profils)" → "Nombre de profils à cibler".
- Décision : NE PAS désactiver le menu Conversation quand son toggle est off (le flux impose de choisir l'agent AVANT de pouvoir l'activer ; désactiver casserait l'assignation). Comportement actuel conservé.
- Point ouvert : revue visuelle validée par Nicolas (retours astérisque + ton corrigés), reste à committer toute la vague.

### Cadence invitations : socle 20 + bugs d'envoi (investigation base + n8n)
- Cause racine "nouveau client à 25" : la colonne `lk_clients_config.daily_invite_limit` avait un DÉFAUT de 25 (> socle 20). Migration `socle_invite_limit_defaut_20` appliquée : défaut passé à 20 + lignes existantes >20 ramenées à 20 (djteks 25→20). Vérifié : défaut=20, les 4 comptes à 20. Fallbacks code des pages prospects/settings aussi passés à 20.
- Écart 25 vs 20 entre écrans expliqué : Réglages bride au socle (20), Recherche prospects affichait la valeur brute (25).
- Écart compteur 11 vs 13 envoyés : la branche auto-invite n'enregistre pas les échecs (invitations refusées par LinkedIn disparaissent sans trace) et ne crée pas de prospect (djteks = 0 prospect malgré 11 invités). Le cron quotidien, lui, fait les deux.
- BUG GRAVE — validation manuelle contournée : lancer la campagne auto "DJ Mariage Auto" a invité 10 profils "à valider" de la campagne MANUELLE "DJ Mariage" + 1 ligne d'un AUTRE compte client. Prouvé par l'output : 12 lignes traitées venant de 3 campagnes / 2 comptes. Cause : la boucle auto-invite n'est pas scopée à la campagne, et `Supabase - Marquer invite` filtre par `account_id+provider_id` (non unique → tombe sur la mauvaise ligne).
- Fix n8n défini (à appliquer par Nicolas, guidé UI) : dans `Auto invite ?` ajouter 2 conditions (`search_id` = campagne courante, `status` = selected, combinateur AND) ; dans `Supabase - Marquer invite` remplacer le filtre par `id eq {{ $('Loop Over Items').item.json.id }}`.
- Point ouvert : Nicolas applique les 2 modifs n8n + test campagne auto 1-2 profils. Contournement en attendant : rester en mode validation manuelle.
- Point ouvert (SÉRIEUX) : fuite multi-tenant constatée (un autre compte client touché par le mismark) — le fix par `id` la ferme, à confirmer.
- Point ouvert : la branche auto-invite devrait créer le prospect + enregistrer les échecs comme le cron quotidien.

### Bug Karine : icebreakers envoyés à des connexions non invitées par le SaaS (investigation + fix n8n)
- Symptôme : 3 icebreakers partis le 29/06 ~09:00 pour Karine (`k.letennier@atil-evenements.com`, account `YIKlrU-VRTG4_VyElJMheg`) vers Vincent Bechtel / Cédric Parat / David Le Tiec.
- Cause racine 1 : le WF Icebreaker `0yQOYs1Ffiqtj4IX` ne lisait JAMAIS `lk_clients_config.icebreaker_enabled`. Il testait `lk_agent_assignments.is_enabled` (toggle par rôle) en le confondant avec le master switch. Les deux colonnes coexistent (dashboard : `toggleRoleEnabled` vs `toggleIcebreakerEnabled`).
- Cause racine 2 : le webhook `new_relation` enrôlait TOUTE connexion acceptée (INSERT aveugle), sans vérifier que le SaaS avait invité la personne. Karine = 0 ligne dans `lk_search_results` → elle a invité ces 3 profils à la main.
- Fait d'archi confirmé : les invités du SaaS sont tracés dans `lk_search_results` (status `invited`, `provider_id` format `ACoAA...` = `user_provider_id` du webhook), PAS dans lk_prospects.
- Fix n8n (guidé UI, pas SDK) : (1) gate `If` génération + (2) gate `If2` envoi vérifient désormais `icebreaker_enabled` ; (3) nouveau nœud `Supabase - Verif invite SaaS` (getAll `lk_search_results` filtré account_id+provider_id+status=invited, limit 1) inséré entre `IF - Exclure compte test (Geoffrey)` et `Supabase - Config client` → 0 item = branche stoppée ; (4) nœud `Update Prospect` remet `processing_status=idle` + vide pending_reply/scheduled_send_at après envoi (verrou processing jamais relâché).
- Nettoyage SQL des 3 prospects (processing_status=idle, file vidée, ai_enabled=false). Lignes conservées (vraies conversations LinkedIn).
- Point ouvert : test de bout en bout (invitation manuelle → vérifier que `Verif invite SaaS` renvoie 0 item et stoppe). Dette UI : unifier les deux switches `icebreaker_enabled` (config) et `is_enabled` (assignation).

### Rangement des workflows n8n dans le repo (nouveau)
- Créé `docs/n8n/` : index README (tableau des 6 workflows nom/ID/rôle/statut/date) + copies JSON nettoyées des workflows live. Pointeur ajouté dans CLAUDE.md (section Pipeline n8n) et dans `docs/n8n/README.md`.
- 6 workflows rangés : Génère lien connexion `wtLJvVIhegJj8szS`, Unipile Notify `i8kR9LQwN8S1GPoH`, Icebreaker LinkedIn `0yQOYs1Ffiqtj4IX`, Conversation `fsSw8bIknV1cAgKx`, Cron invitations+scraping `u9NRd0JkerDhuipM`, IceBreaker #2 legacy Airtable `IBiW7XPBmFjupoWy` (désactivé).
- ALERTE SÉCURITÉ : la `service_role` Supabase + 2 clés Unipile étaient en dur dans les exports (cron + notify). Mises en place pour ne JAMAIS les committer : dossier brut `.n8n-raw/` gitignoré + script `docs/n8n/sanitize.mjs` qui caviarde tout JWT et les clés Unipile connues. Vérifié : 27 secrets caviardés, 0 résiduel dans les fichiers rangés.
- Process de mise à jour acté : re-export n8n -> déposer dans `.n8n-raw/` -> `node docs/n8n/sanitize.mjs` -> MAJ date dans README.
- Point ouvert (SÉCURITÉ, décidé "plus tard") : faire tourner la `service_role` Supabase (compromise) et basculer les usages en dur dans n8n vers des credentials. Mémoire dédiée créée.

### Audit (pas de code modifié, session d'analyse)
- Passé en revue les 24 questions de Geoffrey sur le prompt généré / la base de connaissance, réponses point par point (état actuel vs projection). Bloc copier-coller fourni à Geoffrey.
- Constat icebreaker (`firstMessageTemplate.ts`, V1.3) DÉJÀ avancé : sortie JSON `{message, accroche, profil_insuffisant}`, parsing défensif (strip balises + try/catch, repli brut) dans le modal de test, chargement d'un vrai profil via Unipile (`scrapeLinkedInProfile`), mode diagnostic/proposition_directe porté par `structureMessage`, blocs optionnels qui disparaissent proprement, contrôle de longueur, lien objectif déjà facultatif.
- Constat conversation (`promptTemplate.ts`) = encore l'ancien template "Setter IA" : pas d'états, pas de JSON, pas de plafond, `structureMessage` non injecté. Le méta-prompt Mode B de Geoffrey toujours pas câblé.
- Distinction posée : plusieurs questions (historique réinjecté à chaque tour, JSON à 5 champs etat/raison_handover/enjeu_detecte/cta_propose, plafond cumulé icebreaker+conversation, critères de qualif importants, gestion "êtes-vous une IA" + iaDisclosure, champs problème/preuves obligatoires) décrivent l'agent de CONVERSATION, pas l'icebreaker.

### Points ouverts / décisions
- Point ouvert : récupérer la dernière version du prompt ICEBREAKER envoyée par Geoffrey (pas dans le repo, seul le méta-prompt conversation y est) pour la différencier ligne à ligne avec la V1.3 en live.
- Point ouvert : confirmer avec Geoffrey que les questions historique / JSON 5 champs / plafond / qualif / "êtes-vous une IA" / problème+preuves visaient bien l'agent de conversation.
- Décision à trancher (Q20 versionnage) : prompt figé à la création aujourd'hui, mais `knowledge_base` stocké → régénération possible. Reco = recompilation à la volée depuis `knowledge_base` à terme (cohérent compilateur de config).
- Quick wins UI identifiés (à planifier) : vouvoiement + style sobre par défaut, réaccentuer le texte des prompts (ASCII volontaire, pas un bug d'encodage), renommer "Générer le prompt" → "Créer l'agent", remplacer "business" par "entreprise". Import site/doc pour pré-remplir (Q24) = nouveau chantier à part.

### Build du méta-prompt conversation Mode B (Lots 1 à 3, dashboard)
- Décision actée : la version de référence consolidée Mode B est LA version à câbler. Bandeau de statut de [docs/meta-prompt-conversation-geoffrey.md](./docs/meta-prompt-conversation-geoffrey.md) passé de "pas verrouillé, ne pas câbler" à "validée pour build, pas encore verrouillée".
- Décisions de design : `structureMessage` NON stocké (injecté au runtime par n8n, sinon déduit de l'historique) ; `maxMessages` plafond dans le prompt ET compteur dur n8n (Option B, possédé par l'orchestration car traverse icebreaker+conversation) ; `qualificationCriteria` existant conservé et réinterprété comme "critères importants".
- Lot 1 [promptTemplate.ts](./src/app/dashboard/agents/promptTemplate.ts) : `buildPromptContent` entièrement réécrit en Mode B (trajectoire CAS 1/CAS 2 pilotée par l'état du CTA, sortie JSON `message`/`etat`/`raison_handover`/`enjeu_detecte`/`cta_propose`, anti-enlisement, mise en cause IA, langue tolérante). Nouveaux champs `AgentFormData` : `iaDisclosure`, `maxMessages` (déf 4), `languageMode` (déf fr_tolerant). Blocs offre/preuves/objections/FAQ/prix/neverSay conditionnels.
- Lot 2 [AgentWizard.tsx](./src/app/dashboard/agents/AgentWizard.tsx) : sélecteur Langue (étape 4), critères relabelisés "importants" + sélecteur plafond messages (3/4/5/6) + textarea divulgation IA (étape 5). Rétro-compat édition via `{...EMPTY_FORM, ...knowledge_base}`.
- Lot 3 [TestAgentModal.tsx](./src/app/dashboard/agents/TestAgentModal.tsx) + [actions.ts](./src/app/dashboard/agents/actions.ts) : parsing JSON défensif (strip balises/préambule, isole le 1er objet, fallback texte brut), bulle = `message` + badge état/CTA, message vide (handover silencieux/clôture) en note système exclue de l'historique renvoyé au modèle. `max_tokens` 500 -> 700.
- Validé `tsc --noEmit` OK.
- Point ouvert (PROCHAINE ÉTAPE) : Lot 4 n8n guidé (pas SDK) sur le WF Conversation `fsSw8bIknV1cAgKx` — parsing JSON du retour Claude, règle "envoi ssi message non vide", routage `etat` (handover -> ai_enabled=false + raison, parker/clore -> stop relance), compteur dur `maxMessages`, injection runtime de `structureMessage`.
- Point ouvert : les agents conversation déjà en base gardent leur ancien prompt tant qu'ils ne sont pas réédités-enregistrés (régénération Mode B à l'édition).
- Précision n8n maxMessages (vérifié en base 29/06) : `maxMessages` est stocké DANS `lk_agents.knowledge_base` (JSON), PAS de colonne SQL dédiée (seules colonnes "max" en base : `daily_message_limit`, `response_delay_max_minutes`, sans rapport). Pour le compteur dur : n8n lit `knowledge_base ->> 'maxMessages'` (reco, pas de migration) OU on crée une colonne dédiée. Compte à comparer = `lk_prospects.message_count`, unique sur icebreaker + conversation.

### Lot 4 n8n — cadrage du méta-prompt Mode B (en attente export workflow)
- État confirmé par Nicolas : la file d'attente (`pending_reply` + `scheduled_send_at` + WF Cron d'envoi) est DÉJÀ en place, et AUCUN client n'est en live sur le rôle conversation → on peut builder sans risque de casser une conversation, et sans urgence de séquencement.
- Conséquence sur le modèle queue : « envoyer » = écrire `pending_reply` (= `parsed.message`, texte seul) + `scheduled_send_at`. Le parse JSON doit donc tourner AVANT le nœud qui écrit `pending_reply`, sinon le JSON brut partirait.
- Chaîne cible (après `Claude - Réponse`) : Code Parse réponse IA (strip balises + isole 1er objet + JSON.parse + fallback brut, `should_send = message non vide`) → IF plafond (`message_count >= maxMessages` → backstop `ai_enabled=false`) → Switch par `etat` (continuer/proposer_cta/parker → Calcul timing + Update pending_reply ; rendre_la_main/clore → `ai_enabled=false` + idle ; message vide → idle seul).
- À injecter au runtime dans le user message Claude : indice `structureMessage` lu depuis l'agent icebreaker assigné (`lk_agent_assignments` rôle icebreaker → `lk_agents.knowledge_base.structureMessage`) ; absent = l'agent déduit de l'historique.
- Point ouvert (bloquant pour le guidage nœud par nœud) : récupérer la liste des nœuds (ou l'export JSON) du WF Conversation `fsSw8bIknV1cAgKx` de `Claude - Réponse` jusqu'à la fin — nom du nœud Claude + champ de sortie, nœud `Code - Calcul timing`, nœud Supabase qui écrit `pending_reply`/`scheduled_send_at`.

### Corrections rapport Geoffrey appliquées (dashboard, sans n8n) — FAITES
- Décisions Nicolas tranchées : défauts de voix inversés sur LES DEUX types d'agent (conversation + prise de contact) ; preuve rendue obligatoire EN PLUS de l'objection (on garde l'objection obligatoire, "on fait ce que Geoffrey demande").
- P0 [AgentWizard.tsx](./src/app/dashboard/agents/AgentWizard.tsx) : `problemSolved` ajouté à `step2Valid`, au moins une `proofPoints` ajoutée à `step3Valid` (objection toujours requise). Helper du champ Preuves durci (chiffré/vérifiable + exemple bonne vs mauvaise preuve).
- P1 : défauts de voix inversés → vouvoiement + sobre dans `EMPTY_FORM` (promptTemplate.ts) ET `EMPTY_FIRST_MESSAGE_FORM` (firstMessageTemplate.ts). URL d'objectif rendue facultative (retirée de `step1Valid`, label "(optionnel)") ; le template Mode B gère déjà le cas sans lien.
- P2 wording : "Nom de ton business" → "Nom de ton entreprise" ; bouton "Générer le prompt" → "Créer l'agent" pour les clients (canEditPrompt garde "Générer le prompt").
- P2 réaccentuation : tous les libellés VISIBLES du wizard réaccentués (labels, helpers, placeholders, écrans génération/preview, boutons). Le texte INTERNE des prompts laissé en ASCII volontairement (caché au client, sans impact IA).
- P2 style "capitales espacées" abandonné (demande Geoffrey) : `uppercase tracking-widest` retiré des 20 titres du dashboard sur 7 fichiers (agents AgentsClient/TestAgentModal/TestFirstMessageModal, Sidebar, settings, prospects, admin). Petites pastilles de statut `tracking-wider` ("Forfait", "Actif") conservées. Fait au `sed` après vérif, 0 occurrence résiduelle.
- Rétro-compat : agents existants gardent leurs valeurs (spread `knowledge_base`), seuls les nouveaux prennent les nouveaux défauts. Aucune migration. Validé `tsc --noEmit` OK (exit 0). PAS committé (en attente feu vert + revue visuelle dans l'app du changement de titres, dashboard-wide).

## 2026-06-26 — Retour onboarding Karine (Geoffrey) + corrections agents

### Webhook Unipile message_received auto-géré dans le WF notify (anti-doublon)
- Problème de départ : le webhook `message_received` en `account_ids: []` (tous les comptes) déclenchait aussi sur les comptes WhatsApp/Instagram connectés à Unipile → des milliers d'appels inutiles vers n8n.
- Recherche API Unipile (doc officielle) : AUCUN filtre par provider/type de compte sur les webhooks (seul `account_ids` filtre), et AUCUN endpoint d'update — uniquement create / list / delete. Donc whitelist explicite obligatoire + "supprimer puis recréer" est la seule méthode pour faire évoluer la liste.
- WF notify (webhook `unipile-notify` → PATCH lk_clients_config) étendu : après le PATCH, recrée le webhook `LinkedIn_message_entrant` à chaque nouveau client. Chaîne ajoutée : `Create Webhook` (POST, `account_ids` = comptes LinkedIn lus dans lk_clients_config, `events: ["message_received"]`) → `List WebHook` (GET) → `Find Old webhook` (Code) → `Delete Webhook` (DELETE) → `Respond OK`.
- Ordre create-first volontaire : si la suppression réussit mais la création échoue, on garderait zéro webhook ; en créant d'abord, un pépin laisse juste un doublon (dédupliqué côté lk_messages, et auto-nettoyé au run suivant).
- Bugs résolus pendant le build : (1) sortie de `List WebHook` = un objet unique avec un tableau `.items` imbriqué (pas des lignes n8n) ; (2) identification du nouveau webhook sans référencer le nœud de création par son nom (plantait "Referenced node doesn't exist") → on garde le `LinkedIn_message_entrant` avec le plus de comptes, on supprime les autres ; (3) nœud `Delete Webhook` était en GET par défaut (404 "Cannot GET") → passé en DELETE.
- `Find Old webhook` testé OK (sort bien l'ancien id à 3 comptes `hcIYG_EwR8OTw2Esn24PDA`). Point ouvert : confirmer le test final après passage en DELETE (qu'il ne reste qu'un seul `LinkedIn_message_entrant`, celui à 4 comptes avec Nicolas).
- Point ouvert (sécu) : la service_role key est en dur dans le body du nœud PATCH "Update Supabase" (et a circulé dans l'export partagé) → la passer en credential n8n comme le nœud "Get many rows", et la régénérer dans Supabase par précaution.

### Méta-prompt agent conversation — refonte Geoffrey (en attente, à reprendre)
- Geoffrey a transmis une version de référence consolidée du méta-prompt de l'agent de conversation (Mode B) : trajectoire pilotée par l'état réel du CTA (invitation posée oui/non) plutôt que par le mode déclaré, bascule auto en CAS 2 après proposition, convergence rapide (1 relance d'affinage max), mise en cause IA = passage de main par défaut, contrat de sortie JSON explicite (`message`/`etat`/`raison_handover`/`enjeu_detecte`/`cta_propose`).
- **Geoffrey itère encore dessus, pas verrouillé** → rien câblé pour l'instant. Prompt archivé tel quel dans [docs/meta-prompt-conversation-geoffrey.md](./docs/meta-prompt-conversation-geoffrey.md) pour ne pas le perdre.
- Travail builder à prévoir quand la version sera figée (`promptTemplate.ts` + `AgentWizard.tsx`) : nouveaux champs `structureMessage` (injecté aussi dans le méta-prompt), `iaDisclosure` (optionnel), `maxMessages` (défaut 4, possédé par l'orchestration car traverse 2 prompts), critères de qualif importants séparés, réglage de langue (français tolérant / alignement complet), type d'invitation avec/sans lien, parsing JSON défensif côté n8n.


### Retour reçu (RDV onboarding Karine)
- Geoffrey a transmis le feedback du 1er RDV onboarding : bugs scraping (secteur ignoré, contacts 1er degré présents), bouton "Modifier" agent inopérant, prompt Kaizen visible, message test pas naturel / trop long / avec tirets, + axes UX wizard (tags, préremplissage, lien objectif conditionnel, longueur d'accroche).
- Stratégie validée avec Nicolas : traiter d'abord les corrections, puis la refonte UX du wizard en second temps.

### Correction 1 — Modifier un agent rouvre le wizard pré-rempli (point 2 Geoffrey)
- Le bouton "Modifier" ouvrait une modal basique (nom/objectif/prompt) sans accès aux réponses du formulaire. Désormais il rouvre le wizard complet, pré-rempli depuis `knowledge_base`, pour les agents conversation et prise de contact.
- Édition de tous les champs → "Enregistrer les modifications" → prompt régénéré automatiquement (`buildPromptContent` / `buildFirstMessagePromptContent`) → `updateAgent`. Navigation adaptée en mode édition (Retour = annuler). Relances et agents legacy : modal simple (fallback). `AgentWizard` reçoit une prop `initialAgent` + `key` pour remount propre.

### Correction 2 — Prompt Kaizen totalement masqué aux non-éditeurs (point 3 Geoffrey)
- Avant, le prompt restait visible en lecture seule (modal édition + écrans preview du wizard, création comme modification). Pour un client sans `can_edit_prompt`, plus aucun contenu de prompt affiché : encart neutre "moteur technique géré par Kaizen". Bouton "Tester" conservé.
- Validé : `tsc --noEmit` OK + `npm run build` OK.

### Incident résolu
- `npm run build` lancé pendant que `next dev` tournait a corrompu `.next` (page blanche localhost, code OK). Réparé : arrêt du dev, `rm -rf .next`, redémarrage propre. Leçon : ne pas builder pendant que le dev tourne, `tsc --noEmit` suffit.

### Points ouverts (prochaines corrections du retour Geoffrey)
- Point ouvert : scraping secteur non pris en compte (filtre `industry` inefficace côté Unipile classic/people) + contacts 1er degré dans les résultats (durcir `network_distance`).
- Point ouvert : qualité 1er message (trop long, tirets, pas assez naturel) — renforcer `firstMessageTemplate`, et l'option "exemples de style" ne doit impacter que la forme, pas la longueur.
- Point ouvert : refonte UX wizard reportée (V1.1) — tags multi-valeurs, préremplissage nom/business depuis le compte, lien objectif conditionnel au mode proposition directe, longueur d'accroche (court/moyen/long), exemples concrets pour "Instructions supplémentaires", clarifier "Terrain d'ouverture".

### Fix scroll modales (campagne + wizard agents)
- Modale "Nouvelle campagne" (`ProspectsClient.tsx`) : sur petit écran, le formulaire débordait et les boutons "Lancer la campagne" / "Annuler" étaient inatteignables (pas de `max-h` ni `overflow`, `items-center` qui bloque le scroll). Corrigé : overlay scrollable (`items-start` + `overflow-y-auto` + `py-8`), `overscroll-contain` sur la carte, verrou du scroll page (`html` + `body`) via `useEffect` tant qu'une modale est ouverte. Même fix appliqué à la modale détail campagne et au wizard agents (`AgentsClient.tsx`).

### Statut LinkedIn djteks@gmail.com remis à connecté
- Badge "LinkedIn déconnecté" à tort : en base `is_active = false` alors que côté Unipile le compte (`rsZrC9jYS3am3poE-AZsMg`) est `status OK`. Confirmé l'angle mort connu (`is_active` ≠ vrai statut LinkedIn). Corrigé : `update lk_clients_config set is_active = true`.

### Langue des secteurs d'activité (IndustryPicker)
- Question Nicolas : sur un projet parallèle les secteurs sortaient en anglais. Confirmé via l'API Unipile : les libellés `/search/parameters?type=INDUSTRY` suivent la langue du compte LinkedIn, et le param `locale` est ignoré (pas forçable). Mais cosmétique seulement : on stocke/filtre sur `industry_id` qui est language-independent (ex marketing = id 1862 FR comme EN). Mémoire projet créée.
- Point ouvert : mapping FR maison (id → libellé) si l'anglais gêne vraiment des clients un jour — optionnel.

### Refonte wizard agents — axes Geoffrey (faits)
- Longueur d'accroche : nouveau champ `longueurAccroche` (court/moyen/long, def moyen) dans `firstMessageTemplate`, injecté comme cible en caractères dans le prompt icebreaker (corrige aussi le "message trop long"). Sélecteur 3 boutons dans le wizard.
- Lien objectif conditionnel : "Lien de ton objectif" n'apparaît plus qu'en mode `proposition_directe`.
- "Terrain d'ouverture" reformulé en question claire + helper. Helper enrichi avec exemples concrets pour "Instructions supplémentaires".
- Préremplissage : "Ton nom" depuis `lk_clients_config.full_name` (prop `accountFullName` → `defaults` du wizard), business réutilisé du dernier agent. Mode édition non impacté.
- Prompt template (3 lignes) : exemples de style = ton/forme jamais longueur ni contenu ; consigne de longueur pilotée. EN ATTENTE validation Geoffrey sur ces formulations.

### Fix scraping secteur — sélecteur de secteur LinkedIn (fait, validé djteks)
- Diagnostic (tests Unipile read-only) : le texte libre "agroalimentaire" ne matche AUCUN secteur LinkedIn → résolution renvoie null → filtre silencieusement abandonné = cause racine. La taxonomie LinkedIn a ses propres libellés ("Fabrication de produits alimentaires et boissons"...). Format `industry: [id]` confirmé correct (format doc `{include:[id]}` → 400). Le filtre marche dès que l'ID est valide.
- Solution : champ "Secteur" remplacé par un sélecteur recherche+choix. Server action `searchIndustries(query)` (Unipile `/search/parameters?type=INDUSTRY`), composant `IndustryPicker`, stocke `industry_id` + `industry_label` dans `query_params`, envoie `industry_id` au webhook. `createCampaign` MAJ. tsc OK.
- Validé : campagne test djteks "directeur" + secteur finance → résultats nettement finance/banque (Crédit Agricole, Messis Finance, Aldebaran Capital...) au lieu de tous secteurs. Bonus : le dashboard envoyant désormais un libellé LinkedIn exact, la résolution n8n existante réussit déjà.

### Filtre 1er degré (n8n, fait)
- Ligne `if (p.network_distance === 'DISTANCE_1') return false;` ajoutée dans le `.filter()` des 2 nœuds de scraping (`Flatten + metadata1` chemin webhook + `Code - Resolve et Scrape Unipile` chemin cron) → les contacts déjà connectés (1er degré) ne sont plus insérés.

### Langue des secteurs — le boss veut une vraie solution (point ouvert prioritaire)
- Nouveau constat qui CONTREDIT l'hypothèse "langue = langue du compte" : le compte du boss est en français mais les secteurs sortent en ANGLAIS au scraping. Donc inconsistant et non fiable. Le boss veut que ce soit réglé (risque que d'autres comptes soient en anglais aussi).
- Confirmé par test : aucun param API (`Accept-Language`, `locale`, `language`, `lang`) ne force la langue.
- Piste à instruire : embarquer une liste FR maison (id → libellé FR) harvestée une fois depuis Unipile, et faire la recherche/affichage du sélecteur dessus (l'`industry_id` reste language-independent → le filtre marche partout). Stratégie à détailler.

### Champ "titre de poste" à puces dans la création de campagne (fait)
- Question Nicolas : peut-on cibler plusieurs titres de poste dans une campagne ? Oui, mais LinkedIn ne traite PAS la virgule comme un OU — il faut l'opérateur booléen `OR` (confirmé via `docs/unipile/search.md`). L'ancien champ texte + son aide suggéraient à tort la virgule.
- Nouveau composant `TitlePicker.tsx` (calqué sur `IndustryPicker`) : saisie à puces, ajout par Entrée/virgule/blur, suppression par ✕ ou Backspace, anti-doublon. Le texte en cours de frappe est inclus même sans Entrée (pas de titre perdu au submit).
- Assemblage `OR` côté code : les puces deviennent `"titre A" OR "titre B"` (phrases exactes entre guillemets), format envoyé tel quel à n8n/Unipile — pipeline n8n inchangé.
- `actions.ts` stocke aussi `keywords_list` (JSON) dans `query_params` pour ré-éditer les puces à la duplication ; rétro-compat ascendante (ancien texte libre / format n8n reparsé). Détail campagne affiche les titres lisiblement. `tsc --noEmit` OK.
- Décision : pas de tags transversaux sur les prospects (la campagne reste l'unité de segmentation) ; les "tags" demandés étaient le champ de saisie à puces, désormais livré.

---

## 2026-06-24 — Audit complet + fixes perf/UX agents et campagnes

### Audit sécurité et qualité
- Audit complet réalisé : typecheck (0 erreur), hygiène secrets, RLS, advisors Supabase.
- Confirmé : fonctions admin revérifient `auth.email()` en interne — pas de contournement possible via RPC.
- 3 avertissements advisors remontés : `search_path` mutable sur 3 fonctions PL/pgSQL (à corriger).
- Signalé : `lk_prospects` UPDATE policy sur rôle `public` au lieu de `authenticated` (inoffensif mais à corriger).

### Fix performances — page Conversations
- Vue `lk_last_messages` créée en base : `DISTINCT ON (prospect_id) ORDER BY prospect_id, sent_at DESC`.
- `conversations/page.tsx` : requête `lk_messages` sans limite remplacée par la vue (1 ligne par prospect). Boucle de déduplication JS supprimée.

### Feature — renommage de campagne
- Server action `renameCampaign(id, name)` ajoutée (filtre `account_id` pour la sécurité).
- Modale détail campagne : nom cliquable → input inline, sauvegarde blur/Enter, annulation Échap. Optimistic update dans la liste.

### Fix — détail campagne invisible
- Bug : `query_params` en deux formats (ancien n8n : `search_keywords`... ; nouveau dashboard : `keywords`...). Code lisait uniquement le nouveau format.
- Correction : normalisation des deux formats à la lecture, tous les champs affichés (mots-clés, localisation, réseau, secteur, postes exclus, objectif).
- Bouton "Voir les profils" supprimé de la modale (inutile).

### UX — page Agents
- Bouton "Nouvel agent" transformé en bloc CTA pleine largeur (bordure pointillée, icône +, description).
- Cartes agents colorées par type : icebreaker = teinte accent/bleu, conversation = teinte positive/vert.
- Cartes relances automatiques : teinte ambre (`border-warning/25 bg-warning/[0.04]`).

---

## 2026-06-24 — Stats : redesign KPI en deux groupes

- Page `/dashboard/stats` : KPI réorganisés en deux sections distinctes.
- Groupe "Résultats" (4 cartes mises en avant) : invitations acceptées, taux d'acceptation, messages répondus, taux de réponse.
- Groupe "Actions envoyées" (2 cartes secondaires) : invitations envoyées, messages envoyés.
- Taux d'acceptation = acceptées / envoyées ; taux de réponse = répondus / acceptées (base pertinente).
- `StatCard` enrichi d'une prop `small` pour hiérarchie visuelle entre les deux groupes.
- Déployé en prod (`saas-kaizen.vercel.app`) via `npx vercel --prod` + push GitHub configuré avec token PAT Geoffrey.

---

## 2026-06-24 — Prospection : fix scraping + UI campagnes + pagination invitations

### Fix max_results hardcodé à 50

- Bug identifié dans `actions.ts` : `max_results: 50` envoyé au webhook n8n quelle que soit la saisie client. Corrigé en remplaçant par `targetCount` (variable déjà calculée depuis le champ `target_count` du formulaire).

### Option A : arrêt scraping au plafond (comptage réel en base)

- Refonte des 3 noeuds Code du cron scraping (`u9NRd0JkerDhuipM` branche 8h30) — guidage pas à pas dans n8n (jamais update_workflow SDK).
- "Code - Init scraping par campagne" : requête PostgREST avec `Prefer: count=exact, Range: 0-0` pour lire le vrai nombre de lignes via `content-range` ; si `already >= target` → PATCH status=done et skip.
- "Code - Resolve et Scrape Unipile" : `pageLimit = Math.min(50, remaining)` (plus de 50 hardcodé) ; guard `profiles.slice(0, remaining)` si dépassement.
- "Code - MAJ campagne et Inserer resultats" : insert avec `on_conflict=account_id,provider_id` + `resolution=ignore-duplicates` ; recompte les lignes réelles après insert pour écrire `total_scraped` juste.
- Bug collatéral résolu : contrainte UNIQUE rejetait le batch complet en cas de doublon — corrigé avec ignore-duplicates.

### Contrainte archive + UI campagnes

- Erreur `violates check constraint "lk_searches_status_check"` : la valeur `'archived'` manquait dans le CHECK. Contrainte droppée et recrée avec `ARRAY['active','paused','done','archived']` (migration directe Supabase).
- Section "Archives" ajoutée dans `ProspectsClient.tsx` : accordéon replié par défaut, campagnes archivées en grisé avec stats (scrapés / invités) + bouton supprimer.
- Affichage "Invité le" corrigé : utilise `sent_at ?? created_at` (avant : toujours `created_at`).
- Compteur campagne clampé : `Math.min(actualScraped, target_count)` pour éviter "68/30" sur vieilles campagnes.

### Pagination invitations

- Section "Invitations envoyées" remplacée par "Dernières invitations" (30 lignes, sans filtre inutile côté serveur).
- Nouvelle page `/dashboard/prospects/invited` : pagination serveur 50/page via `.range()`, 4 filtres cumulables (campagne, recherche nom, date de/à), URL-based (shareable). Composant `InvitedFilters.tsx` côté client.

---

## 2026-06-24 — Fix noeud Code workflow Icebreaker (n8n)

- Crash diagnostiqué : `SyntaxError: Unexpected token 'e', "event=new_"... is not valid JSON` dans le noeud Code du workflow Icebreaker (`0yQOYs1Ffiqtj4IX`).
- Cause racine : le noeud Code avait été écrit quand Unipile envoyait du `application/x-www-form-urlencoded`. Il reconstituait `event=new_relation&...` pour le `JSON.parse()`. Unipile envoie maintenant du JSON natif, n8n parse le body automatiquement — le `JSON.parse()` planté sur un objet déjà parsé.
- Fix : remplacer tout le code de reconstruction par `return $input.all().map(item => ({ json: item.json.body }));` — aplatit `body` à la racine sans reconstruction inutile.

---

## 2026-06-24 — Bugfixes UX : modals + slider cadence

### Modals non-fermables par clic extérieur

- `AgentsClient.tsx` : suppression du `onClick` backdrop sur le wizard de création et la modal de formulaire — la fermeture se fait uniquement via "Enregistrer" ou "Annuler".
- `ProspectsClient.tsx` : même correction sur la modal "Nouvelle campagne" + nettoyage du `stopPropagation` devenu inutile sur l'inner div.

### Fix slider cadence quotidienne

- Cause racine : `SOCLE_MAX_INVITE_LIMIT = 20` (code) mais fallback page serveur à `25`. L'état s'initialisait au-dessus du max du slider → thumb bloqué visuellement à 100%, snap à 20 au premier toucher.
- Fix dans `SettingsClient.tsx` : clampage des valeurs initiales avec `Math.min(dailyInviteLimit, SOCLE_MAX_INVITE_LIMIT)` et `Math.min(dailyMessageLimit, SOCLE_MAX_MESSAGE_LIMIT)`.

---

## 2026-06-24 — Onboarding : URL prod + code d'accès

- Confirmé : le code d'accès inscription (`SIGNUP_ACCESS_CODE`) est `kaizen2024`.
- Confirmé : le projet Vercel actif s'appelle `saas-kaizen` (ancienne URL `lk-kaizen.vercel.app` obsolète).
- Bug onboarding : après validation Unipile hosted-auth, les `success_redirect_url` et `failure_redirect_url` pointaient sur `localhost:3000` (hardcodés dans le workflow n8n). Corrigé en remplaçant par `https://saas-kaizen.vercel.app/dashboard/agents?linkedin=ok` (et `?linkedin=error`).

---

## 2026-06-23 — Icebreaker en file d'attente (cron) + finalisation point 9

### Point 9 finalisé (test agent sur vrai profil)

- `scrapeLinkedInProfile` corrigé sur le bon endpoint Unipile (`GET /api/v1/users/{identifier}`), logs debug retirés. Point 9 déclaré terminé et validé.

### Icebreaker : passage en file d'attente comme le WF Conversation (n8n)

- Décision validée : l'Icebreaker (`0yQOYs1Ffiqtj4IX`) ne doit plus envoyer en direct via un nœud Wait live (anti-pattern), mais mettre en file et laisser un cron envoyer dans le créneau client. Construit pas à pas dans l'UI n8n (Nicolas), pas via SDK.
- **Flux webhook (modifié)** : `Switch → message → [NEW] Code - Calcul timing → Supabase - Creer prospect`. Le nœud timing (même code que Conversation) calcule `scheduled_send_at` avec recalage sur active_hours/active_days/timezone. Le prospect est créé en `status='connected'`, `pending_reply=message`, `scheduled_send_at`, `ai_enabled=true`, `message_count=0`, SANS chat_id. Nœuds retirés : `Wait - Delai humain`, `Unipile - Envoyer icebreaker`, `Supabase - Enregistrer message`.
- **Flux cron (nouveau, 5 min, désactivé jusqu'au test)** : `Schedule → Get prospects à envoyer (status=connected, scheduled_send_at<=now, ai_enabled) → IF pending_reply non vide → Loop Over Items (batch 1) → Unipile POST /chats/ (attendees_ids=linkedin_id) → Enregistrer message (lk_messages, message_type=icebreaker) → Update prospect (chat_id réel, in_conversation, message_count=1, vide pending/scheduled) → Wait 30s → reboucle`.
- Bonus : corrige le bug existant où l'Icebreaker stockait `message_id` à la place du `chat_id` (cassait le matching des réponses).
- Pas de plafond de messages sur l'icebreaker (consigne Nicolas) ; le créneau est encodé une fois dans `scheduled_send_at`, le cron compare juste `<= now` (pas de formule en base).
- Points ouverts : (1) vérifier au run que la réponse Unipile `POST /chats/` expose bien `chat_id` et `message_id` ; (2) Test A à faire (insérer 1 ligne de test Nicolas→Geoffrey, filtre `account_id` temporaire sur Get, run manuel) avant d'activer le Schedule ; (3) il faut le `provider_id` LinkedIn de Geoffrey pour la ligne de test.

---

## 2026-06-23 — Rapport quotidien : exploration connected_at

### Analyse colonne connected_at

- Question : peut-on savoir qui a accepté une invitation aujourd'hui pour créer un rapport quotidien ?
- Constaté : la colonne `connected_at` existe déjà sur `lk_prospects` mais n'est jamais alimentée (0 valeur non-nulle).
- Constaté : account_id de Nicolas en mémoire (`fhBcmJdARp2_Du62_6F1xg`) est périmé — le bon est `rsZrC9jYS3am3poE-AZsMg` (email djteks@gmail.com). Mémoire à mettre à jour.
- Point ouvert : le workflow n8n Icebreaker ne setté pas `connected_at` lors du traitement du webhook `new_relation` — à ajouter pour avoir un vrai rapport quotidien des connexions.

---

## 2026-06-23 — Corrections fiche Geoffrey + daily_report + fix relance

### Corrections UI agents/réglages (fiche Geoffrey)

- Socle invitations réduit de 25 à 20/jour (`SOCLE_MAX_INVITE_LIMIT` dans `delayPresets.ts`).
- "Icebreaker" renommé "Prise de contact" partout dans l'UI (AgentsClient, AgentWizard, AdminClient, firstMessageTemplate, TestFirstMessageModal).
- Point 6 : prompt brut masqué pour clients sans `can_edit_prompt` — remplacé par un résumé généré depuis `knowledge_base` (`buildAgentSummary`).
- Point 8 : message fixe repositionné visuellement en option secondaire (border atténuée, label "Ou utiliser un message fixe", description explicative).
- Point 16 : 10 templates de relance ajoutés (`RELANCE_TEMPLATES`) + sélecteur "Choisir un modèle" dans `RelanceCard`.
- Point 19 : champ `ctaUrl` (Lien de ton objectif) ajouté au wizard icebreaker pour les 2 modes, stocké dans `knowledge_base` uniquement (jamais injecté dans le prompt).
- Points 20/21/22 : placeholders agents mis à jour, texte bannière "Comprendre les agents" actualisé, accents corrigés sur Sidebar, AdminClient, AgentWizard, AgentsClient, TestFirstMessageModal.

### Toggle rapport quotidien + fix toggle relance

- Nouveau toggle "Rapport quotidien par e-mail" dans `/dashboard/settings` (section Notifications), connecté à `lk_clients_config.daily_report`. Optimistic update avec rollback sur erreur.

### Test agent sur vrai profil LinkedIn (point 9, EN COURS)

- Nouvelle server action `scrapeLinkedInProfile` dans `agents/actions.ts` : récupère l'`account_id` du client, extrait le slug de l'URL LinkedIn, appelle Unipile.
- `TestFirstMessageModal` : ajout d'un bloc "Charger un vrai profil" (champ URL + bouton) qui auto-remplit prénom / headline / à-propos ; les champs manuels restent éditables.
- Itérations endpoint Unipile : `GET /linkedin/profiles/{id}` (404) → `POST /linkedin/search` avec url (400, n'accepte que les URLs de recherche) → `GET /api/v1/users/{identifier}` (OK).
- Enrichissement du champ "à-propos" : summary + localisation + 3 dernières expériences + 3 derniers posts (`GET /api/v1/users/{provider_id}/posts`).
- Point ouvert : mapping des champs Unipile imparfait (summary et expériences vides, posts réduits à un lien). Logs debug temporaires ajoutés (`PROFILE KEYS` / `PROFILE RAW` / `POSTS RAW`) pour capturer la vraie structure JSON et corriger les noms de champs, puis retirer les logs.
- Server action `updateDailyReport` ajoutée dans `settings/actions.ts`.
- Fix `handleToggle` dans `RelanceCard` : rollback de l'état UI + affichage de l'erreur si le `UPDATE` Supabase échoue (était silencieux avant).
- Point ouvert : `relances_enabled` sur `lk_clients_config` n'est pas câblé côté dashboard — c'est un kill-switch admin distinct de `is_active` par relance.

---

## 2026-06-22 (suite — debug prompt template icebreaker)

### Corrections prompt icebreaker + modal de test

- **Diagnostic root cause** : le résultat `{"message": "", "profil_insuffisant": true}` venait de 3 problèmes cumulés — (1) prompt utilisateur trop pauvre dans `testFirstMessage` (juste prénom/headline/résumé en texte libre), (2) garde-fou `profil_insuffisant` trop sensible dans le prompt système, (3) prompt stocké en base compilé avec l'ancienne version du garde-fou.
- `TestFirstMessageModal.tsx` simplifié : 3 champs uniquement (prénom, headline, à-propos optionnel). L'agent compose avec ce qu'il a, sans nécessiter de données riches.
- `actions.ts` — `testFirstMessage` : prompt utilisateur restructuré en lignes étiquetées (Nom complet / Headline / A-propos). Ajout d'un bloc `<override_test>` appendé au prompt système en mode test uniquement : force `profil_insuffisant: false` quelle que soit la version du prompt stocké en base. Comportement prod (n8n) non affecté.
- `firstMessageTemplate.ts` — section `<donnees_prospect>` : précise que le profil arrive en texte libre et qu'un headline seul suffit pour une accroche de niveau d. Section `<garde_fous>` : `profil_insuffisant` ne se déclenche que si les données sont VRAIMENT vides (ni nom, ni headline, ni secteur).
- `TestFirstMessageModal.tsx` : parse le JSON de sortie et affiche le message proprement, ou le brut si le JSON est invalide.

---

## 2026-06-22 (suite — corrections page prospects + panneau messages)

### Corrections TypeScript et UX ProspectsClient

- Panneau "File d'attente" remplacé par "Messages aujourd'hui" : barre de progression X/40, texte "X restants" ou "Quota atteint", couleur orange si quota dépassé.
- Props `dailyInviteLimit`, `messagesToday`, `dailyMessageLimit` câblés depuis `page.tsx` (query `lk_messages` outbound + `daily_message_limit` dans `lk_clients_config`).
- Compteur `invitesToday` corrigé : source `lk_search_results.sent_at` (plus `lk_prospects`) → évite de dépasser la limite avec les connexions organiques.
- 4 erreurs TypeScript corrigées : `dailyLimit` → `dailyInviteLimit` (2 occurrences), conditions `{qp.keywords && ...}` typées `unknown` → `{!!qp.keywords && ...}`.

---

## 2026-06-22 (suite — workflow Relance + UI relances)

### Workflow n8n Relance (tSXHBrq1Kti67qYx) — refonte complète

- Workflow "Relance" entièrement réécrit via l'API n8n (PUT) : 8 noeuds, architecture single-loop.
- Ancienne architecture supprimée : 2 branches parallèles figées (`lk_agent_assignments` role=`relance_1`/`relance_2`, fenêtres de délai hardcodées 5-10j / 12-18j, noeuds ENVOI disabled).
- Nouvelle architecture : `Get_Prospects` (tous actifs, statut != invited/interested/not_interested) → `Loop_Prospects` → `Get_Relance_Step` (lit `lk_relances` à `position = nb_relance + 1`, `alwaysOutputData: true`) → `Code_Check_And_Build` (delay check dynamique + substitution `{{first_name}}`/`{{last_name}}`) → `IF_Send` → `ENVOI_Unipile` (HTTP) → `Update_Prospect` (Supabase) → `Log_Message` (Supabase).
- Guards dans le Code node : skip si pas de relance à cette position, pas de `chat_id`, pas de `last_message_sent_at`, délai pas encore écoulé. Variable `delay_days` lue dynamiquement depuis `lk_relances`.
- Supporte N niveaux de relance sans modifier le workflow (scale automatique).

### UI /dashboard/agents — Section "Relances automatiques"

- Section dédiée "Relances automatiques" ajoutée entre "Roles actifs" et "Mes agents".
- Deux cartes côte à côte (Relance 1 et Relance 2), chacune avec : toggle actif/inactif (sauvegarde immédiate), textarea message, boutons `{{first_name}}`/`{{last_name}}` avec insertion au curseur, champ "Envoyer après X jours", bouton save orange si modifié.
- Relance 2 : bouton "+ Configurer" visible uniquement si Relance 1 existe.
- Section verrouillée (opacity + pointer-events-none) si `relance` absent de `allowed_roles`.
- Grid "Roles actifs" passée de 3 à 2 colonnes (icebreaker + conversation), relance retirée du grid.
- `AGENT_TYPE_OPTIONS` : option "Relance" retirée (on ne crée plus de relances via les agents).
- `page.tsx` : query `lk_relances` ajoutée (SELECT id, position, content, delay_days, is_active, ORDER BY position), prop `relances` passée à `AgentsClient`.
- TypeScript `npx tsc --noEmit` OK.

---

## 2026-06-22 — Système de campagnes progressif + refonte UI Prospects

### Cron scraping campagnes (n8n)

- Nouveau workflow "Cron - Scraping campagnes" créé via API n8n (5 noeuds), puis fusionné dans le workflow `u9NRd0JkerDhuipM` comme branche 2 (Schedule 8h30).
- Branche 2 : lit les campagnes actives dans `lk_searches`, scrape 50 profils/jour via Unipile avec cursor pagination, insère dans `lk_search_results` (search_id = campaign UUID), PATCH `lk_searches` (last_cursor, total_scraped, status). Testé et validé manuellement.
- Hash SHA-256 côté dashboard vs DJB2 côté ancien WF : nouveau cron bypasse le problème en PATCHant par `id` (UUID) et non `query_hash`.
- Noeud n8n "Code - Init scraping" mis à jour : gestion de la valeur `"2,3"` pour le niveau de relation (→ `['2e degré', '3e degré et +']`).

### Refonte page /dashboard/prospects

- Page restructurée en 3 zones : bandeau quotas du jour (invitations + file d'attente), liste campagnes compacte, table "File d'attente" style Waalaxy + section "À valider" en bas.
- Bandeau quotas : invitations aujourd'hui (X/25, barre de progression), file d'attente (N profils + estimation en jours). Source : `lk_prospects.created_at` pour le comptage journalier + `lk_clients_config.daily_invite_limit`.
- Table file d'attente : colonnes Prospect / Campagne / Exécution (Ce soir / Demain soir / Dans X jours), calculée à partir de la position dans la queue et du quota restant.
- Clic sur une carte campagne = filtre les sections du dessous. État vide explicite quand filtre actif sans profils (message adapté selon mode auto/validation).
- Modal création campagne refaite : niveau de relation en 3 radio-boutons expliqués (2e+3e recommandé, 2e seul, 3e+), labels et placeholders clarifiés.
- Filtre Conversations : `message_count > 0` — les prospects sans échange n'apparaissent plus.

### Corrections base

- `daily_invite_limit` de Nicolas remis à 25 (était à 17 par erreur).
- Toutes les campagnes et résultats de recherche de Nicolas supprimés pour repartir proprement.
- Point ouvert : `total_scraped` peut être décalé si le noeud MAJ n8n échoue après un INSERT réussi — à surveiller.

---

## 2026-06-22 — Cron d'envoi d'invitations : debug et correction

### File d'attente d'invitations quotidiennes

- Migration Supabase `campagnes_prospection_v1` appliquee : extension de `lk_searches` (name, target_count, mode, priority, status, total_scraped, total_sent) et `lk_search_results` (validated_at, sent_at, error_code, network_distance, public_identifier, pending_invitation), contrainte `UNIQUE(account_id, provider_id)`.
- Workflow n8n `u9NRd0JkerDhuipM` etendu avec la section cron (5 noeuds) via l'API REST n8n : Schedule 7h, HTTP Lire clients actifs, Code Build send list, If File non vide, Code Envoyer et traiter.
- Sticky notes ajoutees dans le workflow : 3 bannieres de section + notes explicatives par noeud.
- Bug 1 corrige : noeud "HTTP - Lire clients actifs" ne retournait rien (cles `apikey` et `Authorization Bearer` manquantes, RLS bloquait tout).
- Bug 2 corrige : "Code - Build send list" retournait `__empty` car `$input.first().json` ne lisait que le 1er client sur 3. Remplace par `$input.all()` avec gestion des deux formats n8n (1 item tableau ou N items separes). Logs de debug ajoutes.
- Bug 3 corrige : "Code - Envoyer et traiter" (mode `runOnceForEachItem`) retournait `[{ json: {...} }]` au lieu de `{ json: {...} }` -> erreur "A json property isn't an object". Corrige + appels PATCH/POST Supabase sans `json: true` pour eviter l'erreur de parsing sur les reponses 204.
- Test de bout en bout partiel : Lydie Clark (rsZrC9jYS3am3poE-AZsMg) passee en `selected` manuellement -> invitation envoyee via Unipile -> `status=invited`, `sent_at` rempli en base.

### Strategie scraping progressif (discutee, pas encore implementee)

- Point ouvert : pour scraper 500 profils, il faut un 2e cron de scraping progressif (independant du cron d'invitations). Besoin d'une colonne `cursor` sur `lk_searches` pour la pagination Unipile. A traiter en prochaine session.

---

## 2026-06-22 — Migration repo GitHub

- Remote git local mis a jour : `teksnocode-create/lk-kaizen` -> `geoffrey-kaizen-ia/lk-kaizen`.
- `CLAUDE.md` mis a jour : URL du repo GitHub corrigee pour pointer vers `geoffrey-kaizen-ia`.

---

## 2026-06-19 (suite 3 — doc Unipile search + fix exclude_industry)

### Documentation Unipile — endpoint de recherche

- Analyse de la doc Unipile existante (networking, messaging, accounts, webhooks) : confirmation que la recherche de prospects n'était PAS documentée côté projet.
- Réception de la doc officielle Unipile sur `POST /api/v1/linkedin/search` et `GET /api/v1/linkedin/search/parameters` : endpoint qui couvre Classic, Sales Navigator et Recruiter.
- Créé `docs/unipile/search.md` : endpoint paramètres (résolution IDs localisation/secteur), endpoint recherche (méthode URL copier-coller + paramètres structurés), exemples ATIL (DG/DirCom/Bretagne/secteurs), mapping champs vers `lk_search_results`, pagination via `cursor`, limites LinkedIn par abonnement.
- Mis à jour `docs/unipile/README.md` : ajout de la ligne search.md dans l'index.
- Tableau de limitations établi : compte gratuit (~100-150 vues/mois, profils anonymisés, filtres basiques), Premium Business (vues illimitées), Sales Navigator (filtres fins par fonction/ancienneté/séniorité).

### Erreur de parcours — workflow n8n dupliqué

- Workflow n8n "Kaizen - Recherche Prospects LinkedIn" créé par erreur (id AQspiuomkC7sxH0B) sans analyser le workflow "Scrapping" existant qui couvre déjà tout (résolution IDs, pagination curseur, auto-invite, branche send_invitations, table lk_searches).
- Workflow archivé immédiatement après constat. `.env.local` remis sur l'URL originale `/webhook/Scrapping`.

### Fix exclude_industry — node "Resolve location & build payload1"

- Constat : `search_exclude_industry` était extrait dans "Init config recherche" mais jamais utilisé dans "Resolve location & build payload1".
- Code corrigé fourni : ajout de `resolveParameter('INDUSTRY', search_exclude_industry)` + construction de `searchBody.industry` au format `{ include: [id], exclude: [id] }` au lieu du tableau plat.
- Point ouvert : erreur `$('Code - Compute hash')` lors de l'application du fix — diagnostic probable : test du node en isolation sans exécution complète depuis le webhook. Non confirmé côté Nicolas.

---

## 2026-06-19 (suite 2 — UX edition de prompt)

### AgentsClient — edition de prompt amelioree

- Bouton "Plein ecran" ajoute a cote du label "Prompt" dans la modal d'edition (icone expand, visible uniquement si `canEditPrompt = true`).
- Modal plein ecran : overlay `z-[200]` couvrant tout l'ecran, header avec bouton "Fermer" (icone collapse), textarea `font-mono` qui prend toute la hauteur disponible.
- Textarea du prompt passe en controle (`useState promptContent`) : les deux textareas (modal normale + plein ecran) sont synchronises en temps reel. La fermeture du plein ecran conserve les modifications.
- `promptContent` initialise a l'ouverture de la modal (`openEdit`, `openCreateRelance`, wizard agent vierge).
- TypeScript `npx tsc --noEmit` OK.

### Point ouvert (non encore implemente)

- Point ouvert : quand `can_edit_prompt = false` (defaut pour tout nouveau client), afficher le prompt en lecture seule (texte visible, non editable, aucun bouton ni textarea). Aujourd'hui ce cas affiche juste "Le prompt est genere automatiquement" sans montrer le contenu. Nicolas a confirme l'intention : les clients voient leur prompt mais ne peuvent pas le modifier sans deblocage manuel par Geoffrey.

---

## 2026-06-19 (suite — relances comme agents, refonte UX)

### Decision archi (suite) — relances comme agents dans lk_agent_assignments

- Pivot complet : la section "Relances" autonome (table `lk_relances` + composants `RelancesSection`/`RelanceItem`) abandonnee au profit d'un 3e role "Relance" dans le systeme d'agents existant (`lk_agents` + `lk_agent_assignments`).
- Raisonnement : coherence avec Icebreaker et Conversation — meme paradigme carte + dropdown + CRUD agent.
- Grille /dashboard/agents passee de `sm:grid-cols-2` a `sm:grid-cols-3` pour accueillir la carte Relance.
- Carte Relance : dropdown de selection + bouton "+ Creer une relance" pour instancier un nouvel agent de type relance.
- Toggle "Relance" ajoute dans `/dashboard/admin` (AdminClient) : admin peut activer/desactiver le role pour chaque client (via `allowed_roles`).
- `allowed_roles` defaut ajuste : inclut desormais `relance` en plus de `icebreaker` et `conversation`.

### AgentsClient — modal simplifiee pour les relances

- Detection `isRelance` dans le formulaire (via `knowledge_base.agentType === "relance"`) : affichage conditionnel des champs.
- Champs supprimes pour les relances : type d'agent (select), objectif. Label "Nom" remplace par "Description" (placeholder : "Ex: Relance 1").
- Textarea message de relance : controle par `useState` + `useRef` pour l'insertion a la position du curseur.
- Boutons variables `+ {{first_name}}` / `+ {{last_name}}` : insèrent le token a la position du curseur (via `selectionStart`/`setSelectionRange` + `requestAnimationFrame`).
- Explication en clair ajoutee au-dessus des boutons variables pour les non-techniques.
- Titre du modal contextuel : "Nouvelle relance" / "Modifier la relance" (et non "Nouvel agent").
- Bouton "Tester" masque sur les agents de type relance (`getAgentType(agent) !== "relance"`).
- Typecheck `npx tsc --noEmit` OK.

### Laisse en attente

- Point ouvert : contrat n8n relances (cron d'Anthony) — lire `lk_agent_assignments role='relance'`, recuperer `prompt_content` comme template, envoyer si `now >= last_message_sent_at + delay_days`, uniformiser variables (`{{first_name}}`/`{{last_name}}`).
- Code mort dans `actions.ts` : `createRelance`, `updateRelance`, `deleteRelance`, `moveRelance` (ancien systeme `lk_relances`) — a supprimer apres nettoyage DB.
- Table `lk_relances` et colonnes `relance_1/2_template_id` toujours en base — a dropper apres confirmation avec Anthony.

---

## 2026-06-19 (relances par compte + retrait Invitation recue)

### Check interface — bug trouve

- Les cartes Relance 1/2 (ajoutees en debut de session, modele template global) s'affichaient verrouillees "Forfait" pour tous les clients : `allowed_roles` ne contient jamais `relance_1`/`relance_2` (defaut `{icebreaker,conversation,intent}`) et l'admin ne pouvait pas les debloquer. Cause racine du "tout bug sur l'interface".
- Autres dettes relevees : `lk_relance_templates` est GLOBAL (pas d'account_id) -> "le client modifie une relance" impossible (modifierait pour tous) ; reactivation du mode Agent IA laissait `is_enabled=false` en base ; variables incoherentes (`[prenom]` en base vs `{{first_name}}` dans l'icebreaker).

### Decision archi (validee par Nicolas)

- Agent Intent (scoring) : en PAUSE.
- Role "Invitation recue" (= role `intent` recycle dans l'UI) : ABANDONNE, carte retiree.
- Relances refondues : **messages fixes editables, liste libre, par account_id** (et non plus templates globaux + pointeur). Modele lk_relances.

### Implementation

- MIGRATION `rls_relance_templates_read` : policy SELECT manquante ajoutee sur `lk_relance_templates` (RLS active mais aucune policy = tout bloque). [Devenue accessoire avec la refonte, table desormais orpheline cote dashboard.]
- MIGRATION `create_lk_relances_per_account` : nouvelle table `lk_relances` (id, account_id FK lk_clients_config, position, content, delay_days def 3, is_active, created_at, updated_at) + index (account_id, position). RLS granulaire par commande (SELECT/INSERT/UPDATE/DELETE, pas de FOR ALL), filtree `account_id IN (SELECT ... WHERE user_id = (select auth.uid()))`.
- `agents/actions.ts` : nouvelles actions `createRelance` / `updateRelance` / `deleteRelance` (renumerote 1..n) / `moveRelance` (haut-bas par echange de position). Anciennes `updateRelanceTemplate` + logique relance_N_template_id supprimees.
- `agents/page.tsx` : charge `lk_relances` (ordre position) au lieu de `lk_relance_templates`.
- `AgentsClient.tsx` : ROLES reduit a icebreaker + conversation (grilles passees en `sm:grid-cols-2`). Nouvelle section "Relances" (composants `RelancesSection` + `RelanceItem`) : liste ordonnee, chaque relance = textarea + chips `{{first_name}}`/`{{last_name}}` + champ "envoyer apres X jours sans reponse" + toggle actif + monter/descendre + supprimer + bouton enregistrer (etat "modifie"). Empty state quand aucune relance.
- `AgentWizard.tsx` + `AgentsClient` : type/option "Invitation recue" retire de la creation d'agent (plumbing `invitation_recue` laisse inerte, partage du code avec l'icebreaker).
- Typecheck + `npm run build` OK. Route `/dashboard/agents` compile.

### Laisse dormant (suppression destructive NON faite, a confirmer cote n8n d'Anthony)

- Table globale `lk_relance_templates` (5 lignes), colonnes `lk_clients_config.relance_1_template_id` / `relance_2_template_id`, valeurs `relance_1`/`relance_2` du CHECK `lk_agent_assignments`. A nettoyer une fois verifie qu'aucun workflow n8n ne les lit.

### Contrat n8n relances (a cabler par Anthony)

- Cron : prospect connecte, sans reponse depuis le dernier sortant, ai_enabled, pas opt-out -> prochaine relance = `lk_relances` a `position = nb_relance + 1`, si `is_active` ET `now >= last_message_sent_at + delay_days`. Substitue variables, envoie, ecrit lk_messages (message_type=relance_N), incremente nb_relance, met a jour last_message_sent_at + date_relance. Stop des reponse / statut interested-not_interested / plus de relance active. Respecte plafonds + creneaux.
- Uniformiser les variables cote n8n sur `{{first_name}}` / `{{last_name}}`.

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
