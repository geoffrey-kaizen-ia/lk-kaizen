# Règles de sécurité — Supabase + Auth

---

## Patterns API — obligatoires sur chaque endpoint

- **IDOR** : vérification atomique sur toute opération sensible — `WHERE id=$1 AND user_id=$2`
- **Race conditions** : `SELECT ... FOR UPDATE` sur les ressources partagées
- **Rate limiting** : fail-closed en prod sur login, exports, endpoints IA
- **Tokens** : comparaison avec `crypto.timingSafeEqual()` — jamais `===`
- **Inputs** : validation Zod avec `.strict()` obligatoire — whitelist explicite, pas de passthrough
- **Pagination** : limite dure côté serveur sur toutes les listes — jamais illimitée
- **Secrets** : jamais en dur — `import.meta.env` (front) et `process.env` (back) uniquement

## Authentification & sessions

- Tokens stockés exclusivement en cookies `HttpOnly, Secure, SameSite=Strict`
- `localStorage` et `sessionStorage` interdits pour tout token ou donnée de session
- Ajouter un champ `sessionVersion` dans le profil pour permettre la déconnexion globale
- Vérification blacklist DB sur les tokens révoqués

## Supabase & base de données

- **RLS obligatoire** sur toutes les tables — pas de `FOR ALL`, pas de table sans politique
- Optimiser les politiques avec `(select auth.uid())` pour éviter les appels répétés
- Rôle `anon` : policies restrictives par défaut — refuser si pas de règle explicite
- Fonctions PL/pgSQL avec `SET search_path = ''` pour éviter le schema hijacking
- Extensions installées dans un schéma `extensions` dédié (jamais dans `public`)
- Triggers en écriture sur les colonnes sensibles : `updated_at`, `role`, `sessionVersion`
- Table `audit_logs` pour tracer les actions critiques : acteur, table, diff JSON, timestamp

## IA & agents LLM (si applicable)

- Encadrer les inputs utilisateurs avec des balises explicites : `<user_input>...</user_input>`
- Valider et assainir (XSS) les outputs des LLM avant affichage ou stockage
- Les actions IA opèrent avec le token de l'utilisateur (limité par son RLS)
- Jamais de `service_role` pour une action déclenchée par un agent IA
