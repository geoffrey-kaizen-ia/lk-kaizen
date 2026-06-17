# Kaizen — Dashboard SaaS LinkedIn

Dashboard client pour le SaaS de prospection LinkedIn Kaizen. Les clients y gèrent leurs agents IA de prospection, visualisent leurs conversations et configurent leur compte.

## Stack

- **Next.js 15** (App Router, TypeScript strict)
- **Supabase** (Auth + Postgres + RLS via `@supabase/ssr`)
- **Tailwind CSS v4**
- **n8n** (workflows Icebreaker et Conversation — hors repo)
- **Unipile** (connexion LinkedIn des clients)
- **Anthropic Claude** (mode test des agents)
- **Vercel** (déploiement)

## Fonctionnalités

- Authentification sécurisée (login / signup avec code d'accès)
- Bibliothèque d'agents IA : création via wizard, édition du prompt, assignation par rôle (`icebreaker`, `conversation`, `intent`)
- Mode icebreaker template : message fixe avec variables `{{first_name}}` / `{{last_name}}` en alternative à l'agent IA
- Mode test des agents directement dans le dashboard (appel Claude)
- Pipeline prospects : recherche LinkedIn (via Unipile), sélection manuelle ou auto-invite
- Conversations : fil de messages par prospect, toggle IA par prospect
- Stats : KPIs, cohortes hebdo, messages par jour
- Settings : cadence (limites journalières, créneaux, délais de réponse humanisés, fuseau horaire)
- Page admin (Geoffrey) : gestion des droits par client (`allowed_roles`, `can_edit_prompt`)
- Kill switch global IA dans la sidebar

## Architecture de données

Les tables Supabase sont préfixées `lk_` :

| Table | Rôle |
|---|---|
| `lk_clients_config` | Fiche client (account_id Unipile, settings cadence, droits) |
| `lk_agents` | Bibliothèque de prompts du client |
| `lk_agent_assignments` | Rôle actif par agent (`icebreaker` / `conversation` / `intent`) |
| `lk_prospects` | Prospects LinkedIn (écrit par n8n, lu par le dashboard) |
| `lk_messages` | Messages échangés (lecture seule côté dashboard) |
| `lk_search_results` | Résultats de recherche prospects |

Le RLS Supabase garantit qu'un client connecté ne voit que ses propres données. La `service_role` key n'est utilisée que côté n8n — jamais dans ce repo.

## Installation

```bash
# Installer les dépendances
npm install

# Copier et remplir les variables d'environnement
cp .env.local.example .env.local

# Démarrer en dev
npm run dev
```

## Variables d'environnement

```env
NEXT_PUBLIC_SUPABASE_URL=          # URL du projet Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Anon key uniquement (jamais service_role)

N8N_UNIPILE_CONNECT_URL=           # Webhook n8n pour la connexion LinkedIn (serveur)
N8N_PROSPECT_SEARCH_URL=           # Webhook n8n pour la recherche de prospects

ANTHROPIC_API_KEY=                 # Clé Anthropic pour le mode test des agents (serveur)
```

## Déploiement

Le projet est déployé sur Vercel (`lk-kaizen.vercel.app`). Pousser sur `main` déclenche un déploiement automatique si le repo GitHub est connecté au projet Vercel (Settings → Git → Connect Repository).

```bash
# Déploiement manuel via CLI Vercel
vercel --prod
```

## Sécurité

- RLS activé sur toutes les tables — aucun filtre manuel par client dans les requêtes
- Anon key uniquement dans le frontend
- Inputs validés avec Zod (`.strict()`)
- Tokens stockés en cookies `HttpOnly, Secure, SameSite=Strict`
- Voir `.claude/rules/security-supabase.md` pour le détail des règles
