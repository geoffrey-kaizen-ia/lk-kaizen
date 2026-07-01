# Spec — Crash test des agents de conversation (sas d'éval avant activation)

> Statut : design validé le 2026-06-30 (sections 1 à 4). Prêt pour le plan d'implémentation.
> Rattachement ROADMAP : Phase 5.3 (harness d'évaluation). Source produit : doc externe
> "Crash Test Banque Scenarios" (8 catégories), à porter dans la banque (voir 5).
> Opérateur local : Anthony. Doctrine du prompt / décisions business : Geoffrey.

## 1. Contexte et objectif

On veut un sas qui teste un agent de conversation avant qu'on puisse l'assigner à un rôle de
production chez un client. Tant qu'un agent n'a pas réussi le crash test, son **assignation à un
rôle de prod est refusée**. Le test ne bloque ni la création ni l'édition de l'agent, seulement
son passage en production.

Principe directeur (règle d'or de l'architecture cible) : le LLM rédige, le code décide ce qui
part. Ici, le code décide si un agent est apte.

## 2. Architecture (C2 hybride)

- **Cerveau en TypeScript dans le repo** : scénarios, checkers déterministes, grille du juge,
  calcul du verdict.
- **n8n orchestre la boucle externe** : un scénario à la fois, gère retries et rate-limit
  Anthropic. Choisi pour éviter le timeout court des fonctions serverless Vercel (une banque
  complète avec conversations multi-tours peut prendre plusieurs minutes).
- **La conversation multi-tours qualité tourne en TS** à l'intérieur de l'appel d'un scénario.
- **Données en tables Supabase** (RLS).

```
Déclencheur (création / régénération prompt / bouton manuel)
        │ server action → webhook
        ▼
   n8n (orchestrateur)
        │  1. POST /api/test/start    → crée le run, charge les scénarios
        │  2. POST /api/test/scenario → joue 1 scénario, écrit 1 résultat   (boucle)
        │  3. POST /api/test/finalize → calcule le verdict, met à jour l'agent
        ▼
   lk_test_runs / lk_test_results / lk_agents.test_status
```

## 3. Modèle de données (section 1, validée)

### lk_test_scenarios — la banque
Scénarios universels (socle) et scénarios dérivés d'un client.

| Colonne | Type | Rôle |
| --- | --- | --- |
| id | uuid | Identifiant scénario |
| account_id | text NULL | NULL = scénario universel (banque socle). Sinon scénario dérivé d'un client |
| category | text | Catégorie A à H (voir 5) |
| kind | text | `security` (A/B/C, scripté) ou `quality` (D-H, conversation dynamique) |
| title | text | Libellé court |
| scripted_messages | jsonb | Messages prospect figés (kind=security) |
| persona | jsonb | Profil/consigne du LLM-prospect (kind=quality) |
| expectations | jsonb | Ce que le checker / le juge doit vérifier |
| is_active | boolean | Scénario actif dans la banque |

### lk_test_runs — un passage complet
| Colonne | Type | Rôle |
| --- | --- | --- |
| id | uuid | Identifiant du run |
| agent_id | uuid | Agent testé |
| account_id | text | Client de l'agent |
| status | text | `running` / `passed` / `failed` / `error` |
| trigger | text | `create` / `regenerate` / `manual` / `socle_change` |
| verdict | jsonb | Synthèse (hard fails, scores qualité, seuils appliqués) |
| started_at / finished_at | timestamptz | Horodatage |

### lk_test_results — un résultat par scénario
| Colonne | Type | Rôle |
| --- | --- | --- |
| id | uuid | Identifiant |
| run_id | uuid | Run parent |
| scenario_id | uuid | Scénario joué |
| outcome | text | `pass` / `fail` / `error` |
| score | integer NULL | Note qualité /10 (kind=quality), NULL en sécurité |
| judge_justification | text NULL | Raisonnement du juge |
| transcript | jsonb | **Fil complet** du scénario (messages prospect + sorties JSON agent + verdict juge). Sert la vue admin de debug |

Contrainte d'idempotence : UNIQUE (run_id, scenario_id) pour permettre la reprise n8n sans doublon.

### lk_agents — ajouts
| Colonne | Type | Rôle |
| --- | --- | --- |
| test_status | text | `untested` / `testing` / `validated` / `failed` |
| last_test_run_id | uuid NULL | Dernier run pour ouvrir le rapport |

**Gate** : l'assignation à un rôle de prod est refusée si `test_status != validated`.

## 4. La banque de scénarios (8 catégories)

DÉPENDANCE : le contenu détaillé des 8 catégories vient du doc externe "Crash Test Banque
Scenarios", PAS encore dans le repo. À porter en seed de `lk_test_scenarios`.

- **A, B, C = sécurité** (`kind=security`). Hard fail. Messages prospect figés, on lit le JSON de
  l'agent et des checkers déterministes vérifient le comportement (ex : opt-out respecté, pas de
  prix inventé, mise en cause IA gérée, JSON valide).
- **D à H = qualité** (`kind=quality`). Un LLM joue le prospect en conversation dynamique contre
  l'agent, un juge LLM note le résultat sur 10.

## 5. Déclenchement (section 2, validée)

- **Auto** à la création d'un agent et à chaque régénération de prompt.
- **Bouton manuel** "relancer le test" sur la fiche agent (cas plantage / faux échec, changement
  de banque, re-test de confort).
- **Re-test global** de tous les agents quand on modifie le socle commun. À FAIRE PLUS TARD MAIS
  OBLIGATOIRE (bouton admin), pas dans le V1.

L'agent passe en `test_status=testing` pendant le run, l'UI l'affiche.

## 6. Flux et routes API (section 3, validée)

| Route | Rôle |
| --- | --- |
| `POST /api/test/start` | Crée `lk_test_runs` (running), passe l'agent en `testing`, charge la banque universelle + génère les scénarios client depuis `knowledge_base`, renvoie `run_id` + liste des scénarios |
| `POST /api/test/scenario` | Joue 1 scénario (sécu ou qualité), écrit 1 ligne `lk_test_results`. Idempotent (run_id, scenario_id) |
| `POST /api/test/finalize` | Calcule le verdict, écrit `lk_test_runs`, met à jour `test_status` + `last_test_run_id` |

`/api/test/scenario` réutilise le gabarit de prompt du `TestAgentModal` existant (system =
`prompt_content`, historique, infos prospect, nb échanges).

### Conversation multi-tours qualité (dans /api/test/scenario)
Boucle en TS : le LLM-prospect (persona du scénario) écrit, l'agent répond (son `prompt_content`),
on parse le JSON, on rejoue, jusqu'à la fin de la conversation ou le **plafond de 6 messages
prospect**. Le fil complet est passé au juge, qui rend `{score, justification}`. Tout est stocké
dans `transcript`.

## 7. Verdict (section 4, validée)

- **Sécurité (A/B/C)** : binaire. 1 seul hard fail → run `failed`.
- **Qualité (D-H)** : moyenne **>= 7/10** ET **aucune catégorie < 4/10**.
- Seuils = constantes en code pour le V1.
- **Mode SHADOW au lancement** : la qualité est calculée et affichée mais NE BLOQUE PAS. Seule la
  sécurité bloque. On bascule la qualité en bloquant une fois le juge calibré (accord > 85% sur
  20-30 conversations annotées à la main).

## 8. Composants UI (section 3, validée)

- **Badge de statut** sur chaque carte agent (`/dashboard/agents`) : non testé (gris), test en
  cours (bleu), validé (vert), échoué (rouge).
- **Rapport client** (fiche agent) : réussi/échoué, score par catégorie, justification courte.
- **Vue admin détaillée** (`/dashboard/admin`) : fil complet de chaque scénario, message par
  message, sorties JSON de l'agent, verdict du juge. Outil de debug du prompt, réservé à
  Anthony / Geoffrey.
- **Garde d'assignation** : sélecteur de rôle refuse l'assignation si `test_status != validated`,
  avec message clair.

## 9. Gestion des erreurs (section 4, validée)

Distinguer trois cas :
- **Échec légitime** (faute de l'agent : JSON invalide, hard fail sécu, score trop bas) →
  `outcome=fail`, run `failed`. C'est le but.
- **Erreur technique** (Anthropic down, timeout, rate-limit) → retry n8n (backoff). Si ça
  persiste : run `error`, l'agent GARDE son état précédent, l'UI propose "réessayer". Jamais
  `failed`.
- **Run partiel** → résultats idempotents par (run_id, scenario_id), n8n reprend sans doublon.

Garde-fous : plafond de 6 tours par conversation qualité, timeout par scénario côté n8n.

## 10. Calibration du juge (section 4, validée)

- Prompt de juge figé, grille explicite par catégorie, sortie JSON `{score, justification}`,
  température basse.
- 1 passe au V1. Passage à 2 passes moyennées seulement si la note est instable.
- Calibration avant build : annoter 20-30 conversations de référence à la main, mesurer l'accord
  du juge, ajuster la grille jusqu'à accord > 85%. Tant que ce n'est pas atteint, la qualité reste
  en shadow.

## 11. Tests du harness lui-même

- Checkers sécu = fonctions pures → tests unitaires (TDD), entrée = JSON agent connu, sortie =
  pass/fail attendu.
- Golden agents : 1 bon, 1 mauvais, passés dans tout le harness, on assert le verdict.
- Juge : régression sur le set de calibration (snapshot, pas déterministe).

## 12. Décisions actées (2026-06-30)

Orchestration du méta-prompt Mode B :
1. Trio CTA : `proposer_cta` = état, `cta_propose` = booléen, `coordonner_cta` = raison de
   handover (oui à un call sans lien → confirme + passe la main pour caler).
2. Handover : message vide = silencieux ; message plein = actif.
3. `parker` = pause (relances possibles) ; `clore` = définitif (plus rien ne part).
4. Les relances ne comptent PAS dans le plafond de 4 messages de l'agent.
5. Statut CRM "rendez-vous pris" : N'EXISTE PAS aujourd'hui, on le CRÉE (étendre le CHECK de
   `lk_prospects.status`, l'écrire côté n8n quand le RDV est acté, l'afficher au CRM).

Design : voir sections 5 à 11.

## 13. Questions ouvertes (pour Geoffrey)

- Déclencheur exact du statut "rendez-vous pris" : à l'accord du prospect, ou à la confirmation
  humaine que le RDV est calé ?
- Sécurité (hors design) : repo GitHub à passer en privé + PAT de Geoffrey à régénérer.

## 14. Découpage d'implémentation (à détailler dans le plan)

1. Migration : tables `lk_test_scenarios` / `lk_test_runs` / `lk_test_results` + colonnes
   `test_status` / `last_test_run_id` sur `lk_agents` + RLS.
2. Seed de la banque sécurité (A/B/C) depuis le doc externe + checkers déterministes (TDD).
3. Routes API `start` / `scenario` (sécurité d'abord) / `finalize`.
4. UI : badge de statut + garde d'assignation + rapport client + vue admin transcripts.
5. Workflow n8n orchestrateur (boucle, retries, idempotence).
6. Volet qualité : LLM-prospect + juge + calibration (shadow).
7. Statut CRM "rendez-vous pris" (CHECK + n8n + affichage).
8. Plus tard : bouton "re-tester tous les agents" (socle).
