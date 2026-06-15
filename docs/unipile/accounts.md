# Unipile - Comptes (Accounts)

## Liste de tous les comptes

`GET /api/v1/accounts`

Retourne tous les comptes connectés à Unipile (tous types confondus).

### Query params

| Param | Type | Defaut | Description |
| --- | --- | --- | --- |
| `cursor` | string | - | Curseur de pagination (valeur reçue dans la réponse précédente) |
| `limit` | integer | 100 | Nb d'items (1-250) |

### Réponse 200

```json
{
  "object": "AccountList",
  "items": [ /* tableau d'Account */ ],
  "cursor": "next_page_cursor_or_absent"
}
```

### Structure d'un compte LinkedIn

```json
{
  "object": "Account",
  "type": "LINKEDIN",
  "id": "<account_id>",
  "name": "Prénom Nom",
  "created_at": "2025-12-31T23:59:59.999Z",
  "connection_params": {
    "linkedin": {
      "member_id": "ACoAAA...",
      "username": "prenom-nom"
    }
  },
  "sources": [
    {
      "id": "LINKEDIN",
      "status": "OK"
    }
  ]
}
```

### Valeurs de `sources[].status`

| Valeur | Signification |
| --- | --- |
| `OK` | Connexion active, tout fonctionne |
| `CONNECTING` | En cours de connexion |
| `STOPPED` | Service arrêté manuellement |
| `ERROR` | Erreur non spécifiée, service arrêté |
| `CREDENTIALS` | Credentials expirés, reconnexion requise |
| `PERMISSIONS` | Permissions manquantes sur le device |

**Pour Kaizen** : c'est `sources[0].status === "OK"` qui détermine si le LinkedIn est vraiment connecté. Cette valeur doit alimenter `lk_clients_config.linkedin_status`.

### SDK Node

```ts
import { UnipileClient } from "unipile-node-sdk"

const client = new UnipileClient(BASE_URL, ACCESS_TOKEN)
const response = await client.account.getAll()
// response.object === "AccountList"
// response.items : Account[]
```

---

## Récupérer un compte par son ID

`GET /api/v1/accounts/:account_id`

Retourne un seul compte. Utile pour vérifier le statut d'un compte LinkedIn spécifique.

### Paramètre de chemin

| Param | Description |
| --- | --- |
| `account_id` | L'`id` Unipile du compte (= `account_id` dans `lk_clients_config`) |

### Réponse 200

Même structure qu'un item dans la liste ci-dessus.

### Réponse 404

```json
{ "object": "Error", "message": "Account not found" }
```

### SDK Node

```ts
const account = await client.account.getOne(account_id)
// account.sources[0].status === "OK" => LinkedIn connecté
```

---

## Connecter un compte LinkedIn (authentification native)

`POST /api/v1/accounts`

> **Kaizen n'utilise pas cette méthode.** La connexion passe par le Hosted Auth (voir [hosted-auth.md](hosted-auth.md)). Cette section est documentée pour référence uniquement.

Deux méthodes disponibles pour LinkedIn :

### Méthode 1 : username + password

```json
{
  "provider": "LINKEDIN",
  "username": "email@exemple.com",
  "password": "motdepasse"
}
```

### Méthode 2 : cookie `li_at`

```json
{
  "provider": "LINKEDIN",
  "access_token": "<valeur du cookie li_at>",
  "premium_token": "<valeur du cookie li_a (optionnel, Recruiter/SN)>"
}
```

### Options communes (optionnelles)

| Champ | Description |
| --- | --- |
| `country` | Code pays ISO (ex: `"FR"`) pour le proxy |
| `proxy` | Objet `{ protocol, host, port, username?, password? }` |
| `user_agent` | User-agent du navigateur si problème de déconnexion |
| `sync_limit.chats` | Date UTC ou quantité de chats a synchroniser en historique |
| `sync_limit.messages` | Date UTC ou quantité de messages a synchroniser en historique |
| `disabled_features` | Array : `linkedin_recruiter`, `linkedin_sales_navigator`, `linkedin_organizations_mailboxes` |

### Réponses possibles

| Status | Objet | Signification |
| --- | --- | --- |
| 201 | `Account` | Compte connecté directement |
| 200 | `AccountCheckpoint` | Checkpoint requis (2FA, captcha, etc.) -- voir ci-dessous |

### Checkpoint (2FA / vérification)

Si LinkedIn demande une vérification, la réponse contient :

```json
{
  "object": "AccountCheckpoint",
  "account_id": "<id>",
  "checkpoint": {
    "type": "2FA_CODE",
    "message": "Enter the code sent to your email"
  }
}
```

Il faut alors appeler `POST /api/v1/accounts/:account_id/solve-checkpoint` avec le code reçu.

---

## Reconnecter un compte LinkedIn (après déconnexion)

`POST /api/v1/accounts/:account_id`

> **Kaizen n'utilise pas cette méthode directement.** Si un client doit reconnecter son LinkedIn (status `CREDENTIALS` ou `ERROR`), le flux passe par le Hosted Auth (voir [hosted-auth.md](hosted-auth.md)), pas par les credentials directs.

A utiliser quand `sources[].status` vaut `CREDENTIALS` ou `ERROR` sur un compte existant. Contrairement à la connexion initiale, l'`account_id` est déjà connu et passé dans le path.

### Différence avec "Connecter"

| | Connecter | Reconnecter |
| --- | --- | --- |
| Endpoint | `POST /api/v1/accounts` | `POST /api/v1/accounts/:id` |
| Quand | Premier lien du compte | Compte déjà connu, session expirée |
| Body | Identique (provider + credentials) | Identique |

### SDK Node

```ts
await client.account.reconnect({
  account_id,
  provider: "LINKEDIN",
  username: "email@exemple.com",
  password: "motdepasse",
})
// Peut retourner un AccountCheckpoint si 2FA demandé (même logique que connect)
```

---

## Supprimer un compte

`DELETE /api/v1/accounts/:account_id`

Délie le compte de Unipile. Action irréversible -- l'`account_id` ne sera plus valide.

**Pour Kaizen** : à appeler côté n8n (service_role) si un client supprime son compte. Après suppression, mettre `account_id = null` et `linkedin_status = null` dans `lk_clients_config`.

### Réponses

| Status | Objet | |
| --- | --- | --- |
| 200 | `{ "object": "AccountDeleted" }` | Succès |
| 404 | `errors/resource_not_found` | account_id inconnu |

### SDK Node

```ts
await client.account.delete(account_id)
```

---

## Resynchroniser les messages d'un compte LinkedIn

`GET /api/v1/accounts/:account_id/sync`

Déclenche (ou surveille) la synchronisation de l'historique de messagerie. Supporté pour LinkedIn uniquement dans Kaizen.

**Pour Kaizen** : à appeler depuis n8n juste après la connexion d'un nouveau compte (notify_url callback) pour charger l'historique des conversations dans Unipile avant que n8n ne les écrive dans `lk_messages`.

### Query params (LinkedIn)

| Param | Type | Description |
| --- | --- | --- |
| `partial` | boolean | `true` = garde les données déjà syncées, `false` = resync complet |
| `after` | number | Epoch ms -- ne syncer qu'à partir de cette date |
| `before` | number | Epoch ms -- ne syncer que jusqu'à cette date |
| `chunk_size` | number | Nb de chats par chunk (si sync paginée) |
| `linkedin_product` | string | `classic` / `recruiter` / `sales_navigator` (vide = tout) |

### Réponse 200

```json
{
  "object": "AccountResync",
  "status": "SYNC_STARTED"
}
```

### Valeurs de `status`

| Valeur | Signification |
| --- | --- |
| `SYNC_STARTED` | Sync lancée |
| `SYNC_RUNNING` | En cours |
| `CHUNK_DONE` | Un chunk terminé, d'autres à venir |
| `SYNC_DONE` | Terminé avec succès |
| `SYNC_ERROR` | Erreur -- un nouvel appel relance une sync fraiche |

**Polling** : rappeler le même endpoint pour suivre l'avancement. Un appel après `SYNC_DONE`, `CHUNK_DONE` ou `SYNC_ERROR` repart d'une sync fraiche.

---

## Codes d'erreur Unipile (référence commune)

Tous les endpoints peuvent retourner ces erreurs :

| Type | Status | Signification |
| --- | --- | --- |
| `errors/disconnected_account` | 401 | Compte déconnecté du provider (LinkedIn) |
| `errors/expired_credentials` | 401 | Session expirée, reconnexion requise |
| `errors/invalid_credentials` | 401 | Mauvais username/password |
| `errors/expired_link` | 401 | Lien Hosted Auth expiré |
| `errors/resource_not_found` | 404 | account_id inconnu |
| `errors/provider_error` | 500 | LinkedIn en erreur, réessayer |
| `errors/no_client_session` | 503 | Session Unipile inactive |
| `errors/request_timeout` | 504 | Timeout, réessayer |

---

## Types de comptes (non utilisés dans Kaizen)

Unipile supporte d'autres types de comptes : `MOBILE`, `MAIL`, `GOOGLE_OAUTH`, `ICLOUD`, `OUTLOOK`, `WHATSAPP`. Seul `LINKEDIN` est pertinent pour ce projet.
