# Architecture cible — Agents conversationnels Kaizen

Source : challenge d'architecture fourni par Geoffrey (patron de Kaizen IA) le 12/06/2026.
Ce document est la référence doctrine. La déclinaison en chantiers concrets vit dans `ROADMAP.md`.

## Règle d'or

**Le LLM rédige, le code décide ce qui part.**

## Les 4 couches

### Couche 1a — Policy engine (code déterministe, jamais le LLM)

Les protections vitales ne dépendent JAMAIS de l'obéissance du LLM. Elles s'exécutent en code avant et après l'appel LLM, filtrent ses sorties et peuvent le couper :

- Plafonds de volume quotidien (durs dans le socle, ajustables uniquement à la baisse par le client)
- Fenêtres horaires, fuseau, jours actifs, mode vacances
- Cooldowns entre relances, plafond de relances (0 à 2 max)
- Arrêt immédiat sur opt-out ("stop", "pas intéressé", "supprimez mes données")
- Détection de réponse qui déclenche le handover humain
- Blacklists (clients existants, partenaires, concurrents, domaines exclus)
- Interdiction d'envoyer un lien ou un prix au premier message
- Délais de réponse humanisés (jamais de réponse en 30 secondes à 3h du matin)
- Kill switch global en un clic, côté client et côté Kaizen

Dans notre stack actuelle : ces règles vivent dans n8n (nodes If/Code déterministes) et dans les colonnes de contrôle Supabase, PAS dans prompt_content.

### Couche 1b — Socle comportemental (méta-prompt Kaizen)

Porte ce qui est réellement comportemental : ton de base, philosophie anti-spam, structure conversationnelle, angles. C'est l'expertise commune Kaizen, versionnée, identique pour tous les clients.

### Couche 2 — Config client (paramétrique, compilée, jamais du texte libre brut)

La personnalisation est majoritairement paramétrique (enums, toggles, curseurs) plus quelques champs libres qui passent par un compilateur de config : validation automatique de cohérence avec le socle, refus de ce qui le contredit, production d'un prompt final versionné.

**Précédence non négociable : règles légales > socle Kaizen > config client.** Le client personnalise à l'intérieur du cadre, jamais le cadre.

Dans notre stack actuelle : `AgentWizard.tsx` + `promptTemplate.ts` est l'embryon de ce compilateur (choix structurés -> prompt). À renforcer : validation des champs libres, versionnage du prompt produit.

### Couche 3 — Harness d'évaluation (permanent, pas une phase)

Trois niveaux :

1. **Linting déterministe** (code, instantané, à chaque message, en pré-prod ET en prod) : longueur, pas de lien/prix au 1er message, registre tu/vous conforme, zéro claim hors liste blanche, pas d'emoji si interdit, pas de mention concurrent. Tout échec bloque l'envoi.
2. **Scénarios conversationnels simulés** : un second LLM joue le prospect avec une banque de personas adversariaux (le pressé, le sceptique, le tutoyeur, l'agressif, le hors-sujet, demande de prix au 2e message, "vous êtes une IA ?", "envoyez-moi un mail", "rappelez-moi dans 6 mois", le concurrent, le DPO, la question hors base, l'injecteur de prompt). Croisement persona x objectif x mode x registre. Un golden set figé de 60 à 80 scénarios (régression) + un pool rotatif régénéré.
3. **Scoring hybride** : règles dures (auto-échec : promesse chiffrée, claim inventé, poursuite après stop, non-escalade obligatoire, fuite du prompt) + LLM-juge à grille notée (fidélité offre, conformité ton, naturel, progression sans forcing, rebond sur objection). Calibrer le juge sur 30 à 50 conversations annotées à la main ; tant que l'accord humain/juge est sous ~85%, corriger la grille du juge, pas l'agent.

Deux étages :

- **Éval du SOCLE** : 300 à 500 scénarios incluant le red-teaming, à chaque nouvelle version du méta-prompt ou du policy engine. Jamais par client.
- **Éval de CONFIG CLIENT** : à chaque onboarding et modification de config, 60 à 100 scénarios instanciés sur l'offre/ton/objectif du client, en moins d'une heure, rapport en sortie. Go-live : 100% sur les bloquants, 90-95% sur la qualité, revue humaine des 10 pires transcripts. Le rapport est montré au client (argument de réassurance).

Entre l'éval et le go-live : **shadow mode** (20 à 30 vrais prospects en mode brouillon, chaque message validé humainement), puis autonomie graduée : brouillon -> semi-auto (ouvertures auto, réponses en brouillon) -> full auto quand le taux de retouche tombe sous ~10%. Le passage d'un cran est une décision données, pas une date.

### Couche 4 — Boucle d'apprentissage post-déploiement

Chaque semaine : échantillonner 10 à 15% des vraies conversations, les repasser au juge, classer les échecs dans une taxonomie d'erreurs (claim limite, ton dévié, handover raté, relance maladroite, objection mal traitée), corriger au bon endroit (socle si transverse, config si propre au client), repasser le golden set en non-régression, déployer en canary (2-3 clients pilotes d'abord).

Sans cette couche, l'expertise accumulée cesse de s'accumuler au lancement. Avec elle, chaque client améliore le socle de tous les autres.

**Prérequis contractuel** : clause d'apprentissage anonymisé dans les CGV avant le premier client SaaS.

## Versionnage

Socle vX + config client vY = comportement reproductible. Toute évolution du socle part en canary sur 2-3 clients pilotes avant généralisation. Le journal d'audit enregistre pour chaque message envoyé : horodatage, version du socle et de la config qui l'ont produit (protection contractuelle).

## Référentiel de personnalisation (9 blocs, V1/V2)

Les 5 features non négociables qui font le sérieux du produit : **liste blanche de claims, exclusions CRM, seuils d'escalade du Mode B, autonomie graduée, journal d'audit versionné.**

### Bloc A — Identité et voix
- [V1] Persona émetteur (qui parle, rôle, bio courte)
- [V1] Tutoiement/vouvoiement par défaut + bascule si le prospect tutoie
- [V1] Ton en presets (direct, chaleureux, expert, institutionnel), pas de champ libre
- [V1] Longueur cible par type de message (ouverture, relance, réponse)
- [V1] Lexique : expressions fétiches, mots interdits, emojis (jamais par défaut), signature
- [V1] Échantillons de voix : 3 à 5 messages/posts du client comme exemples de style (différenciateur "votre voix")
- [V2] Langues de travail et détection de la langue du prospect

### Bloc B — Offre et connaissance
- [V1] Fiche offre structurée : proposition de valeur, bénéfices, cibles, différenciants
- [V1, critique] Liste blanche de claims : seuls chiffres/affirmations autorisés, validés par le client. Pare-feu anti-hallucination commerciale.
- [V1] Base de connaissances avec règle dure : hors base, l'agent esquive ou escalade
- [V1] Sujets interdits : concurrents nommés, politique, prix (interdit par défaut, configurable), promesses de résultat
- [V2] Réponses validées par objection courante, éditables par le client

### Bloc C — Ciblage et sources
- [V1] ICP : fonctions, secteurs, zones, tailles, mots-clés, et surtout les EXCLUSIONS (clients existants via sync CRM/import, partenaires, concurrents, domaines blacklistés)
- [V1] Sources : recherche LinkedIn/Sales Navigator, listes importées, réactivation réseau 1er degré
- [V2] Commentateurs de posts, visiteurs de profil
- [V1] Signaux de personnalisation autorisés (publications, poste, actu entreprise) et interdits (rien de personnel/privé)

### Bloc D — Objectif et mode
- [V1] Objectif par campagne : conversation seule (handover), clic ressource, inscription événement, RDV (Calendly), appel
- [V1] Mode A / Mode B par campagne. En Mode B, seuils d'escalade OBLIGATOIRES : demande de prix, signal d'achat fort, agressivité, question hors base, sujet sensible, demande RGPD -> l'humain reprend, toujours
- [V1] Politique de relance : nombre (0 à 2, plafond socle), délais, angles, conditions d'arrêt
- [V1, doctrine à trancher MAINTENANT] Transparence IA : le socle impose la réponse honnête à "vous êtes un bot ?", le client choisit seulement la formulation

### Bloc E — Cadence et sécurité du compte
- [V1] Volumes quotidiens : plafonds durs socle, ajustables à la baisse uniquement
- [V1] Warm-up progressif des comptes neufs/dormants
- [V1] Fenêtres horaires, fuseau, jours actifs, mode vacances
- [V1] Délais de réponse humanisés
- [V2, vite] Monitoring santé du compte : taux d'acceptation qui chute -> ralentissement auto
- [V2] Multi-comptes par client

### Bloc F — Supervision et contrôle (feature signature)
- [V1] Autonomie graduée : brouillon -> semi-auto -> full auto
- [V1] Inbox unifiée avec étiquetage auto (intéressé, objection, pas maintenant, opt-out)
- [V1] Notifications de handover (email/WhatsApp/Slack) + alerte si personne ne reprend sous X heures
- [V1] Kill switch : pause globale en un clic, côté client et côté Kaizen

### Bloc G — Intégrations
- [V1] Calendly/agenda, export CRM/CSV
- [V2] Webhooks/Zapier/Make, sync CRM bidirectionnelle

### Bloc H — Conformité et gouvernance
- [V1] Opt-out automatique, registre des objections, purge sur demande
- [V1] Journal d'audit : chaque message envoyé avec horodatage + version socle + version config

### Bloc I — Reporting
- [V1] Dashboard par cohorte hebdo : invitations, acceptations, réponses, conversations engagées (au sens de la garantie), actions CTA
- [V1] Compteur de garantie visible (150 conversations, où en est-on)
- [V2] Extraits des meilleures conversations, taux par angle de message

## Décisions stratégiques à trancher

1. **SaaS pour qui ?** Recommandation Geoffrey : cockpit interne d'abord (opérateurs Kaizen premiers utilisateurs, client en lecture/validation), self-serve en option future. L'architecture en couches sert les deux.
2. **Transparence IA** : doctrine à fixer avant d'écrire une ligne de plus (réponse honnête imposée par le socle).
3. **Clause d'apprentissage anonymisé** dans les CGV avant le premier client SaaS.

## Prochains artefacts attendus (proposés par Geoffrey)

1. Le référentiel ci-dessus en spec structurée avec valeurs par défaut du socle
2. La banque de scénarios d'éval V1 : personas adversariaux rédigés + grille de scoring du juge + seuils de go-live

Rôles : Nabil challenge l'architecture, Nicolas implémente dans n8n.
