# Unipile - Networking LinkedIn (invitations, connexions)

Endpoints pour gérer les invitations LinkedIn. Utilisés par n8n pour suivre l'état des prospects au stade `invited` dans `lk_prospects`.

---

## Lister les invitations envoyées (en attente)

`GET /api/v1/users/invite/sent`

Retourne toutes les invitations LinkedIn envoyées et encore en attente de réponse.

**Pour Kaizen** : permet à n8n de vérifier quels prospects sont en statut `invited` (invitation envoyée, pas encore connectés). Utile pour relancer ou changer de stratégie après X jours sans réponse.

### Query params

| Param | Requis | Description |
| --- | --- | --- |
| `account_id` | oui | Le compte LinkedIn du client |
| `cursor` | non | Pagination |
| `limit` | non | 1-250 |

### Réponse 200

```json
{
  "object": "InvitationList",
  "items": [ /* InvitationSent[] */ ],
  "cursor": null
}
```

### Structure d'une InvitationSent

```json
{
  "object": "InvitationSent",
  "id": "<invitation_id>",
  "invited_user": "Prénom Nom",
  "invited_user_id": "<linkedin_member_id>",
  "invited_user_public_id": "prenom-nom-xxx",
  "invited_user_description": "CEO @ Acme",
  "date": "il y a 3 jours",
  "parsed_datetime": "2025-12-28T10:00:00.000Z",
  "invitation_text": "Bonjour, je souhaitais vous contacter...",
  "inviter": {
    "inviter_name": "Nom Client",
    "inviter_id": "<linkedin_member_id_client>",
    "inviter_public_identifier": "nom-client",
    "inviter_description": "Fondateur @ Kaizen"
  },
  "specifics": {
    "provider": "LINKEDIN",
    "shared_secret": "<secret>"
  }
}
```

### Champs clés pour Kaizen

| Champ | Usage |
| --- | --- |
| `invited_user_id` | LinkedIn member_id = `lk_prospects.linkedin_id` |
| `parsed_datetime` | Date d'envoi (format ISO -- plus fiable que `date` en texte relatif) |
| `invitation_text` | Message d'invitation envoyé |
| `specifics.shared_secret` | Necessaire pour annuler une invitation (voir "Annuler une invitation") |

### SDK Node

```ts
const response = await client.users.getAllInvitationsSent({
  account_id: "<account_id>",
  limit: 250,
})
// response.items : InvitationSent[]
// item.invited_user_id => lk_prospects.linkedin_id
```

---

## Lister les invitations reçues (en attente)

`GET /api/v1/users/invite/received`

Retourne toutes les invitations LinkedIn reçues et encore en attente de réponse (ni acceptées ni refusées).

**Pour Kaizen** : moins utilisé que "invitations envoyées" dans le flow de prospection, mais utile si on veut détecter des prospects qui ont pris l'initiative de contacter le client -- signal d'intérêt fort.

### Query params

| Param | Requis | Description |
| --- | --- | --- |
| `account_id` | oui | Le compte LinkedIn du client |
| `cursor` | non | Pagination |
| `limit` | non | 1-100 (défaut 10) |

### Réponse 200

```json
{
  "object": "InvitationList",
  "items": [ /* InvitationReceived[] */ ],
  "cursor": null
}
```

### Structure d'une InvitationReceived

Structure identique à `InvitationSent` avec `object: "InvitationReceived"`. Différence de perspective : ici `inviter` = le prospect qui a envoyé l'invitation, `invited_user` = le client.

```json
{
  "object": "InvitationReceived",
  "id": "<invitation_id>",
  "invited_user": "Nom Client",
  "invited_user_id": "<linkedin_member_id_client>",
  "invited_user_public_id": "nom-client",
  "invited_user_description": "Fondateur @ Kaizen",
  "date": "il y a 1 semaine",
  "parsed_datetime": "2025-12-28T10:00:00.000Z",
  "invitation_text": "Bonjour, j'aimerais rejoindre votre réseau",
  "inviter": {
    "inviter_name": "Prénom Nom Prospect",
    "inviter_id": "<linkedin_member_id_prospect>",
    "inviter_public_identifier": "prenom-nom-prospect",
    "inviter_description": "CTO @ Startup"
  },
  "specifics": {
    "provider": "LINKEDIN",
    "shared_secret": "<secret>"
  }
}
```

### Champs clés pour Kaizen

| Champ | Usage |
| --- | --- |
| `inviter.inviter_id` | LinkedIn member_id du prospect = `lk_prospects.linkedin_id` |
| `parsed_datetime` | Date de réception (format ISO) |
| `invitation_text` | Message accompagnant l'invitation |
| `specifics.shared_secret` | Necessaire pour accepter ou refuser l'invitation |

### SDK Node

```ts
const response = await client.users.getAllInvitationsReceived({
  account_id: "<account_id>",
  limit: 100,
})
// response.items : InvitationReceived[]
// item.inviter.inviter_id => lk_prospects.linkedin_id
```

---

## Lister toutes les relations (connexions 1er degré)

`GET /api/v1/users/relations`

Retourne tous les contacts LinkedIn du 1er degré d'un compte -- c'est-à-dire tous les profils qui ont accepté une invitation (ou dont l'invitation a été acceptée).

> **Attention** : endpoint potentiellement coûteux côté LinkedIn (scraping du réseau entier). Consulter les limites fournisseur avant d'automatiser à haute fréquence.

**Pour Kaizen** : utilisé par n8n pour vérifier qu'un prospect est bien passé en `connected` (statut `lk_prospects.status`), ou pour initialiser le profil d'un prospect enrichi de son `headline` et `profile_picture_url`.

### Query params

| Param | Requis | Description |
| --- | --- | --- |
| `account_id` | oui | Le compte LinkedIn du client |
| `filter` | non | Filtrer par nom (recherche textuelle) |
| `cursor` | non | Pagination |
| `limit` | non | 1-1000 (défaut 100) |

### Réponse 200

```json
{
  "object": "UserRelationsList",
  "items": [ /* UserRelation[] */ ],
  "cursor": null
}
```

### Structure d'une UserRelation

```json
{
  "object": "UserRelation",
  "first_name": "Prénom",
  "last_name": "Nom",
  "headline": "CEO @ Acme",
  "public_identifier": "prenom-nom-xxx",
  "public_profile_url": "https://www.linkedin.com/in/prenom-nom-xxx",
  "created_at": 1735689600000,
  "member_id": "<linkedin_member_id>",
  "member_urn": "urn:li:member:...",
  "connection_urn": "urn:li:connection:...",
  "profile_picture_url": "https://media.linkedin.com/..."
}
```

### Champs clés pour Kaizen

| Champ | Usage |
| --- | --- |
| `member_id` | LinkedIn member_id = `lk_prospects.linkedin_id` |
| `created_at` | Epoch ms -- date à laquelle la connexion a été établie |
| `headline` | Poste actuel -- enrichissement de `lk_prospects` |
| `profile_picture_url` | Photo de profil |

> `created_at` est en millisecondes epoch (pas ISO). Convertir : `new Date(created_at).toISOString()`.

### SDK Node

```ts
const response = await client.users.getAllRelations({
  account_id: "<account_id>",
  limit: 1000,
})
// response.items : UserRelation[]
// item.member_id => lk_prospects.linkedin_id
// new Date(item.created_at).toISOString() => date de connexion
```

---

## Envoyer une invitation LinkedIn

`POST /api/v1/users/invite`

Envoie une invitation de connexion à un prospect LinkedIn. C'est l'action principale de l'agent **icebreaker** dans Kaizen.

> **Attention** : LinkedIn impose des limites hebdomadaires d'invitations (environ 100-200/semaine selon le type de compte). Surveiller `usage` dans la réponse.

**Pour Kaizen** : appelé par n8n quand un nouveau prospect entre dans le pipeline. Après succès, mettre `lk_prospects.status = "invited"`.

### Corps (JSON)

| Champ | Requis | Description |
| --- | --- | --- |
| `account_id` | oui | Le compte LinkedIn du client (Unipile account_id) |
| `provider_id` | oui | LinkedIn member_id du prospect = `lk_prospects.linkedin_id` |
| `message` | non | Message d'invitation (max 300 caractères) |
| `user_email` | non | Email du prospect si requis par LinkedIn (rare) |

### Réponse 200

```json
{
  "object": "UserInvitationSent",
  "invitation_id": "<invitation_id>",
  "usage": 42
}
```

> `usage` : pourcentage du quota LinkedIn utilisé. Unipile ne le retourne que lorsqu'un palier est franchi (50%, 75%, 90%, 95%). Si absent, le quota n'a pas atteint de nouveau palier.

### Erreurs 422 importantes

| Type | Cause |
| --- | --- |
| `errors/already_connected` | Prospect déjà en 1er degré -- pas besoin d'inviter |
| `errors/already_invited_recently` | Invitation déjà envoyée récemment, pas encore répondu |
| `errors/cannot_invite_attendee` | LinkedIn interdit d'inviter ce profil |
| `errors/user_unreachable` | Profil inaccessible (compte fermé, paramètres) |
| `errors/blocked_recipient` | Le prospect a bloqué le client |
| `errors/limit_exceeded` | Quota hebdomadaire LinkedIn dépassé |

> En cas de `already_connected` ou `already_invited_recently`, n8n doit mettre à jour le statut dans `lk_prospects` sans recompter l'erreur comme un échec.

### SDK Node

```ts
const response = await client.users.sendInvitation({
  account_id: "<account_id>",
  provider_id: "<linkedin_member_id_prospect>",
  message: "Bonjour, j'aimerais échanger avec vous sur...",
})
// response.object === "UserInvitationSent"
// response.invitation_id : string (pour tracking dans lk_prospects)
// response.usage : number | undefined
```
