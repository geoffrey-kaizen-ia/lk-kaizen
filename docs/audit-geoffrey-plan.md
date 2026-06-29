# Plan de réponse à l'audit Geoffrey

> État vérifié contre le code réel le 29/06/2026 (4 explorations ciblées, écran par écran).
> Règle de lecture : chaque point porte un **statut réel** (FAIT / PARTIEL / À FAIRE / DÉCISION),
> une **faisabilité** (trivial / moyen / complexe) et un **propriétaire** (Dashboard direct / n8n guidé / Base / Geoffrey).
> Rappel contrainte : toute modif n8n se fait **en guidant Nicolas dans l'UI**, jamais via SDK → ces lots sont plus lents.

## Constat global

L'audit suppose une plateforme moins avancée qu'elle ne l'est. Beaucoup de constats sont **déjà adressés**, dont une vague de corrections appliquée le **29/06 dans le working tree, non committée** (revue visuelle en attente — voir ROADMAP Phase 4 ligne « CORRECTIONS RAPPORT GEOFFREY ») :
P0 `problemSolved`/`proofPoints` obligatoires, défauts de voix inversés (vouvoiement+sobre), `business`→`entreprise`, bouton « Créer l'agent », ré-accentuation des libellés, abandon des capitales sur ~20 titres.

Ce qui reste se répartit en **3 familles** :
1. **Finitions wording/cohérence** restantes (triviales, ~1 session) — la vague 29/06 n'a pas tout couvert (stats / conversations / pipeline notamment).
2. **Vraies features manquantes** (contrôles humains inbox, actions CRM, métriques santé compte) — chantiers dashboard moyens.
3. **Décisions produit + câblage n8n** (compteur/relances, créneaux 1er message, réactivation réseau, mode hard test) — bloqués par arbitrage ou par le Lot 4 n8n.

---

## WAVE 0 — Sécuriser l'existant (préalable)

| Action | Statut | Faisab. | Propriétaire |
| --- | --- | --- | --- |
| Revue visuelle + `tsc --noEmit` + commit de la vague 29/06 (working tree modifié non committé) | À FAIRE | trivial | Dashboard |

Sans ce commit, toute nouvelle modif risque de se mélanger à du travail non revu. **À faire avant la Wave 1.**

---

## WAVE 1 — Finitions wording & cohérence inter-écrans (1 session, trivial)

Tout est Dashboard direct, faisabilité triviale sauf mention.

| # | Constat audit | Statut réel | Preuve | Action |
| --- | --- | --- | --- | --- |
| L1-4 | « Icebreaker » persiste dans l'UI client | À FAIRE | `AgentsClient.tsx:527, 603` | → « Prise de contact ». Ligne 132 = compat legacy data, ne pas toucher |
| L1-5 | Vouvoiement « vos vrais prospects » | À FAIRE | `TestAgentModal.tsx:213` | → « tes vrais prospects » |
| L1-6 | Mot « prompt » exposé dans la modale test | À FAIRE | `TestAgentModal.tsx:273` | reformuler « son prompt actuel » sans le mot prompt |
| L1-8 | « Style de conversation » vs « Style de message » | À FAIRE (moyen) | `AgentWizard.tsx:1129 vs 589` | unifier le libellé des deux branches (un objet = un nom) |
| L3-1 | Plafond invitations défaut 25 ≠ socle 20 | À FAIRE | `prospects/page.tsx:73`, `settings/page.tsx:29` | fallback `?? 25` → `?? 20` (les 2 pages) |
| L2-1 | Slider « invitations acceptées / jour » | À FAIRE | `SettingsClient.tsx:130` | → « invitations envoyées / jour » (le cron n8n plafonne bien les **envois**, label seul est faux) |
| L2-6 | « warm-up » en anglais | À FAIRE | `SettingsClient.tsx:27` | → « démarrage » / « rodage » |
| L4-14 | Statut « En discussion » (conv) ≠ « En conversation » (CRM) | À FAIRE | `ConversationsClient.tsx:32` vs `PipelineClient.tsx:31` | unifier sur un seul libellé |
| L6-15 | « Tiede » sans tréma + colonnes CRM bas-de-casse/sans accents | À FAIRE | `PipelineClient.tsx:181, 207-213` | « Tiède », « Dernière activité » |
| L4-4 | Accents incohérents stats (periode, recus, repondus) | À FAIRE | `StatsClient.tsx:91-93, 180, 232` | ré-accentuer |
| L3-4 | « Objectif (profils) » : « objectif » déjà utilisé pour le but de l'agent | À FAIRE | `ProspectsClient.tsx:1058` (form) vs `:921` (modale) | renommer « Nombre de profils à cibler » + cohérence form/modale |
| L1-13 | Déroulant Conversation cliquable même toggle off | À FAIRE | `AgentsClient.tsx:742` | `disabled={isPending || !isEnabled}` |
| P2 | Capitales espacées encore présentes hors agents | À VÉRIFIER | grep : `uppercase tracking-[0.2em]` subsiste sur `StatsClient`, `ConversationsClient`, `PipelineClient`, `Sidebar` | finir l'abandon sur titres de section (garder les pastilles de statut) |

**Déjà FAIT, ne rien faire** (vérifié) : em-dash dans UI/prompts (corrigé), `business`→`entreprise`, `problemSolved`/`proofPoints` obligatoires, bouton conditionnel « Créer l'agent », test adapté au type d'agent (TestAgentModal vs TestFirstMessageModal), relances **hors** liste « Mes agents » (section dédiée), file de validation manuelle, compteurs du jour, secteur en liste fermée LinkedIn, rapport quotidien email, lien CRM→Conversations.

---

## WAVE 2 — Rôles actifs & garde-fous Mode B (1 session, dashboard)

| # | Constat | Statut | Faisab. | Action |
| --- | --- | --- | --- | --- |
| L1-9 | État actif peu lisible dans « Mes agents » | PARTIEL | moyen | Les badges de rôle existent (`AgentsClient.tsx:1390`). Renforcer : badge explicite « Actif · rôle X » vs « Inactif », en miroir de Rôles actifs |
| Pilot-2 | Avertissement Mode B sans amont | À FAIRE | moyen | Avertissement **à l'activation** du toggle Conversation si aucun 1er message configuré (passer outre possible) |
| Pilot-4 | Cohérence de voix non garantie | DÉCISION + À FAIRE | moyen | V1 : avertissement de divergence de ton dans Rôles actifs. (Option lourde « identité de voix partagée » = post-V1) |

---

## WAVE 3 — Mode test enrichi (dashboard, moyen→complexe)

| # | Constat | Statut | Faisab. | Action |
| --- | --- | --- | --- | --- |
| L1 P0-1 | Agent conversation déraille au test (pas d'ancrage) | À FAIRE | moyen | Reconstituer le contexte de départ : injecter un 1er message + profil avant la 1re réponse |
| Pilot-5 / L1-17 | Choisir un prospecteur existant dans le test | À FAIRE | complexe | Déroulant des agents prise-de-contact pour précharger leur vrai 1er message |

---

## WAVE 4 — Inbox Conversations : contrôles humains (dashboard + dépend n8n)

L'inbox a le squelette (2 panneaux, filtre statut, toggle IA par prospect) mais **pas les contrôles fins**. Dépend en partie du Lot 4 n8n qui écrit `etat`/`raison_handover`.

| # | Contrôle attendu | Statut | Faisab. |
| --- | --- | --- | --- |
| L5-7a | Reprendre la main / écrire un message à la main puis rendre la main | À FAIRE | moyen |
| L5-7b | Mode review (IA propose, humain valide) vs full-auto par conversation | À FAIRE | complexe |
| L5-7c | Pause IA par fil (existe déjà via toggle ai_enabled) | FAIT | — |
| L5-7d | Changer le statut manuellement (dont RDV pris) | À FAIRE | moyen |
| L5-7e | Raison du handover affichée | À FAIRE | moyen (dépend n8n écrit `raison_handover`) |
| L5 réf-12 | File « conversations à traiter » (handover + RDV à caler) | À FAIRE | moyen |

---

## WAVE 5 — CRM : actions sur prospect (dashboard, moyen)

Le drawer affiche les infos mais **zéro bouton d'action** (`PipelineClient.tsx:451-536`).

| # | Action | Statut | Faisab. |
| --- | --- | --- | --- |
| L6-12a | Changer le statut à la main (dont RDV pris / converti) | À FAIRE | moyen |
| L6-12b | Pause/reprise IA depuis le drawer | À FAIRE (affichage seul aujourd'hui) | trivial |
| L6-12c | Note interne | À FAIRE | moyen (colonne DB) |
| L6-12d | Exclure / blacklister (lien anti-doublon) | À FAIRE | moyen (colonne + respect n8n) |
| L6-12e | Export CSV (réversibilité / RGPD) | À FAIRE | moyen |
| L6-11 | Lien retour Conversations→CRM | PARTIEL | trivial (CRM→Conv existe, l'inverse non) |

---

## WAVE 6 — Statistiques : santé du compte (dashboard + data)

Les métriques de **performance** sont là ; les métriques de **sécurité anti-spam** sont absentes.

| # | Métrique | Statut | Faisab. | Note data |
| --- | --- | --- | --- | --- |
| L4-2a | Invitations en attente sous seuil 500 | À FAIRE | moyen | source : Unipile (pending) ou `lk_search_results` invited non acceptées |
| L4-2b | Alerte chute anormale du taux d'acceptation (relatif) | À FAIRE | complexe | besoin d'une normale glissante du compte |
| L4-2c | Similarité des messages | À FAIRE | complexe | hors V1 réaliste, à reporter |

---

## WAVE 7 — Policy engine & cadence (n8n guidé, dépend Lot 4)

| # | Constat | Statut | Action |
| --- | --- | --- | --- |
| Pilot / L2-3 | Créneaux couvrent-ils le 1er message de prise de contact ? | À VÉRIFIER (probable FAIT) | l'Icebreaker WF « gère cadence/créneau » (README n8n) → confirmer dans `icebreaker.json` que le 1er message passe par `Code - Calcul timing` |
| Doctrine-3 | Compteur 4 messages : les relances comptent-elles ? | DÉCISION + n8n | trancher puis câbler le compteur dur (Lot 4 n8n : count outbound traverse icebreaker+conversation) |
| Doctrine-4 | Enchaînement relances ↔ conversation (qui reprend si réponse après relance ?) | DÉCISION + n8n | machine à états : réponse → stop relances + conversation prend le relais |
| Robust-1 | Pause auto de l'envoi à la déconnexion LinkedIn | À VÉRIFIER + n8n | l'alerte email existe ; confirmer que l'envoi se met en pause |
| Robust-2 | Anti-doublon / exclusions (déjà touché, client existant, conv en cours) | À VÉRIFIER | contrainte UNIQUE existe ; confirmer la couverture exclusions |

---

## WAVE 8 — Décisions produit (Geoffrey) — bloquent l'exécution

Ces points ne sont pas du code, ce sont des **arbitrages** :

1. **Écart posts** (Doctrine-2) : injecter les posts du prospect (tenir la promesse d'accroche sur publication) **ou** aligner les exemples de l'UI sur le profil statique réellement injecté. *Reco : aligner les exemples en V1, injecter les posts en V1.1 (le scrape posts existe déjà côté test agent).*
2. **Réactivation réseau existant** (Écart #1, section dédiée) : confirmé absent, **report assumé**. Acter (a) discours commercial = froid seulement en V1, (b) inscription roadmap V2 (source 1er degré Unipile + quota distinct + agent réactivation qui s'enfiche dans la même séquence — modèle brique).
3. **Relances paramétrables par campagne** (nombre / délai / contenu) : reco oui, par campagne.
4. **Sort du prospect après relances épuisées** : statut « froid » / « en sommeil » à définir.
5. **Statut terminal « RDV pris »** (L5/L6) : ajouter au-delà d'« Intéressé », cohérent sur Conversations + CRM + Stats + états n8n (`parker`/`clore`).
6. **Modèle brique vs séquence** : décision déjà prise (rester brique en V1).
7. **Identité de voix partagée vs avertissement** : décision déjà prise (avertissement en V1).

---

## WAVE 9 — Mode HARD TEST / harness d'évaluation (chantier futur)

= Couche 3 de l'architecture cible (Phase 5.3 ROADMAP). Gros chantier, **post-V1**, déjà cadré dans la doctrine :
linting déterministe (bloque l'envoi), banque de personas adversariaux + golden set 60-80, LLM-juge calibré, éval de config à l'onboarding, shadow mode → autonomie graduée. Sécurité en tolérance zéro (vérifiée au caractère sur le contrat à états `etat`/`raison_handover`), qualité notée par juge. **Ne pas démarrer avant** le Lot 4 n8n (contrat à états réellement produit en prod).

---

## Synthèse stratégique

- **Quick wins immédiats** (Waves 0→2) : ~2-3 sessions dashboard, faisabilité triviale à moyenne, ferment ~70% des constats P1/P2 de l'audit. À enchaîner sans dépendance externe.
- **Features dashboard** (Waves 3→6) : contrôles inbox, actions CRM, santé compte — moyen, certaines dépendent du Lot 4 n8n pour les données.
- **n8n + décisions** (Waves 7→8) : plus lents (guidage manuel + arbitrage Geoffrey). À séquencer après que Geoffrey ait tranché les 7 points de la Wave 8.
- **Harness** (Wave 9) : stratégique, post-V1.

**Chemin critique** : Wave 0 (commit) → Lot 4 n8n (contrat à états, déjà au ROADMAP) débloque les raisons de handover (Wave 4), le compteur/relances (Wave 7) et le hard test (Wave 9).
