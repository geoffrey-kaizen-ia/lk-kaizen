# Unipile - Messagerie (Chats & Messages)

Tous les endpoints de cette page sont utilisés par n8n pour lire les conversations LinkedIn et alimenter `lk_prospects` et `lk_messages`. Le dashboard Kaizen est en lecture seule sur ces données.

---

## Lister les conversations (chats)

`GET /api/v1/chats`

### Query params

| Param | Type | Description |
| --- | --- | --- |
| `account_id` | string | Filtrer par account_id Unipile (peut être une liste séparée par virgules) |
| `account_type` | string | `LINKEDIN` pour filtrer uniquement LinkedIn |
| `unread` | boolean | `true` = non lus seulement, `false` = lus seulement |
| `after` | string | ISO 8601 UTC -- chats créés après cette date |
| `before` | string | ISO 8601 UTC -- chats créés avant cette date |
| `cursor` | string | Pagination |
| `limit` | integer | 1-250 (défaut 100) |

### Réponse 200

```json
{
  "object": "ChatList",
  "items": [ /* Chat[] */ ],
  "cursor": "next_page_or_null"
}
```

### Structure d'un Chat LinkedIn

```json
{
  "object": "Chat",
  "id": "<chat_id>",
  "account_id": "<account_id>",
  "account_type": "LINKEDIN",
  "provider_id": "<linkedin_thread_id>",
  "attendee_provider_id": "<linkedin_member_id_du_prospect>",
  "name": "Prénom Nom",
  "type": 0,
  "timestamp": "2025-12-31T23:59:59.999Z",
  "unread_count": 2,
  "archived": 0,
  "muted_until": null,
  "read_only": 0,
  "pinned": 0,
  "folder": ["INBOX", "INBOX_LINKEDIN_CLASSIC"],
  "content_type": null
}
```

### Champs clés

| Champ | Valeurs | Notes |
| --- | --- | --- |
| `type` | `0` = 1-to-1, `1` = groupe, `2` = autre | Pour Kaizen : `0` uniquement (prospects) |
| `folder` | `INBOX_LINKEDIN_CLASSIC`, `INBOX_LINKEDIN_RECRUITER`, `INBOX_LINKEDIN_SALES_NAVIGATOR`, `INBOX_LINKEDIN_ORGANIZATION` | Filtrer sur `INBOX_LINKEDIN_CLASSIC` pour les prospects standards |
| `content_type` | `inmail`, `sponsored`, `linkedin_offer`, `null` | `null` = message direct standard |
| `attendee_provider_id` | string | LinkedIn member_id du prospect -- sert a lier avec `lk_prospects.linkedin_id` |
| `archived` | `0` / `1` | |
| `read_only` | `0` / `1` / `2` | |

### SDK Node

```ts
const response = await client.messaging.getAllChats({
  account_id: "<account_id>",
  account_type: "LINKEDIN",
  limit: 100,
})
// response.object === "ChatList"
// response.items : Chat[]
// response.cursor : string | null (pour pagination)
```

---

## Démarrer une nouvelle conversation

`POST /api/v1/chats`

> **Corps en `multipart/form-data`, pas JSON.**

Utilisé par n8n pour envoyer le premier message d'un agent (icebreaker) à un prospect LinkedIn.

### Champs requis

| Champ | Type | Description |
| --- | --- | --- |
| `account_id` | string | L'`account_id` Unipile du client |
| `attendees_ids` | string[] | LinkedIn member_id(s) du/des prospect(s) -- valeur `attendee_provider_id` du Chat |

### Champs optionnels

| Champ | Type | Description |
| --- | --- | --- |
| `text` | string | Contenu du message |
| `attachments` | file[] | Pièces jointes |
| `subject` | string | Objet (conversations de type inMail) |
| `linkedin.api` | string | `classic` (defaut) / `recruiter` / `sales_navigator` |
| `linkedin.inmail` | boolean | `true` = envoyer comme inMail |

> **Piege** : pour le champ `linkedin`, la syntaxe en multipart est `linkedin[api]=classic` et `linkedin[inmail]=true`, pas un objet JSON imbriqué.

> **`attendees_ids`** : pour LinkedIn classic, utiliser un `provider_id` commençant par `ACo`. C'est la valeur `attendee_provider_id` du Chat (voir "Lister les conversations").

### Réponse 201

```json
{
  "object": "ChatStarted",
  "chat_id": "<chat_id>",
  "message_id": "<message_id>"
}
```

### Erreurs 422 importantes

| Type | Cause |
| --- | --- |
| `errors/no_connection_with_recipient` | Prospect pas en 1er degré LinkedIn |
| `errors/user_unreachable` | Prospect inaccessible |
| `errors/not_allowed_inmail` | inMail non autorisé pour ce prospect |
| `errors/limit_exceeded` | Quota LinkedIn d'envoi dépassé |
| `errors/blocked_recipient` | Prospect a bloqué l'expéditeur |

---

## Lister les participants d'une conversation

`GET /api/v1/chats/:chat_id/attendees`

Utile pour récupérer les infos LinkedIn d'un prospect (nom, occupation, headline, photo) à partir d'un chat. Utilisé par n8n pour enrichir `lk_prospects` lors de la découverte d'une conversation.

### Réponse 200

```json
{
  "object": "ChatAttendeeList",
  "items": [ /* ChatAttendee[] */ ],
  "cursor": null
}
```

### Structure d'un ChatAttendee LinkedIn

```json
{
  "object": "ChatAttendee",
  "id": "<attendee_id>",
  "account_id": "<account_id>",
  "provider_id": "<linkedin_member_id>",
  "name": "Prénom Nom",
  "is_self": 0,
  "picture_url": "https://...",
  "profile_url": "https://www.linkedin.com/in/...",
  "specifics": {
    "provider": "LINKEDIN",
    "member_urn": "urn:li:member:...",
    "occupation": "CEO @ Acme",
    "headline": "Entrepreneur | SaaS",
    "location": "Paris, France",
    "network_distance": "DISTANCE_1",
    "pending_invitation": false,
    "contact_info": {
      "emails": [],
      "phone_numbers": [],
      "websites": []
    }
  }
}
```

### Champs clés pour Kaizen

| Champ | Notes |
| --- | --- |
| `provider_id` | LinkedIn member_id = `lk_prospects.linkedin_id` |
| `is_self` | `1` = le compte client lui-même, `0` = le prospect |
| `specifics.network_distance` | `DISTANCE_1` = connecté, `DISTANCE_2/3` = pas encore connecté |
| `specifics.occupation` | Poste actuel du prospect |
| `specifics.pending_invitation` | `true` = invitation envoyée, pas encore acceptée |

> **Pour identifier le prospect** : filtrer `is_self === 0`. Dans une conversation 1-to-1, il n'y a qu'un seul attendee avec `is_self === 0`.

### SDK Node

```ts
const response = await client.messaging.getAllAttendeesFromChat(chat_id)
const prospect = response.items.find(a => a.is_self === 0)
// prospect.provider_id = linkedin_id pour lk_prospects
// prospect.specifics.occupation, .headline, .location
```

---

## Lister les messages d'une conversation

`GET /api/v1/chats/:chat_id/messages`

Utilisé par n8n pour lire les messages d'une conversation LinkedIn et les écrire dans `lk_messages`.

### Query params

| Param | Type | Description |
| --- | --- | --- |
| `chat_id` | string | (path) ID Unipile du chat |
| `after` | string | ISO 8601 UTC -- messages après cette date (pour sync incrementale) |
| `before` | string | ISO 8601 UTC |
| `sender_id` | string | Filtrer par expéditeur (LinkedIn member_id) |
| `cursor` | string | Pagination |
| `limit` | integer | 1-250 (défaut 100) |

### Réponse 200

```json
{
  "object": "MessageList",
  "items": [ /* Message[] */ ],
  "cursor": "next_page_or_null"
}
```

### Structure d'un Message LinkedIn

```json
{
  "object": "Message",
  "id": "<message_id>",
  "chat_id": "<chat_id>",
  "account_id": "<account_id>",
  "sender_id": "<linkedin_member_id>",
  "text": "Bonjour, je voulais vous contacter...",
  "timestamp": "2025-12-31T23:59:59.999Z",
  "is_sender": 1,
  "is_event": 0,
  "deleted": 0,
  "seen": 1,
  "message_type": "MESSAGE",
  "attachments": []
}
```

### Champs clés pour Kaizen

| Champ Unipile | Colonne `lk_messages` | Notes |
| --- | --- | --- |
| `text` | `content` | Contenu du message |
| `timestamp` | `sent_at` | Date envoi |
| `is_sender` | `direction` | `1` = `outbound` (client), `0` = `inbound` (prospect) |
| `sender_id` | -- | LinkedIn member_id -- permet d'identifier le prospect |
| `account_id` | `account_id` | Clé de jointure client |

### Filtres recommandés pour n8n

- Exclure les events systeme : `is_event === 0`
- Exclure les messages supprimes : `deleted === 0`
- Sync incrementale : passer `after` = date du dernier message connu

### Valeurs de `message_type`

| Valeur | Signification |
| --- | --- |
| `MESSAGE` | Message standard |
| `INVITATION` | Invitation de connexion |
| `INMAIL` | InMail |
| `INMAIL_ACCEPT` / `INMAIL_DECLINE` / `INMAIL_REPLY` | Réponse a un inMail |

### SDK Node

```ts
const response = await client.messaging.getAllMessagesFromChat({
  chat_id: "<chat_id>",
  after: "2025-01-01T00:00:00.000Z",
  limit: 100,
})
// response.items : Message[]
// is_sender === 1 => outbound, 0 => inbound
```

---

## Lister tous les participants (tous chats confondus)

`GET /api/v1/chat_attendees`

Même structure que "Lister les participants d'un chat", mais sans `chat_id` -- retourne tous les attendees connus pour un compte.

**Pour Kaizen** : utile en n8n pour construire un index des prospects déjà connus sur un compte LinkedIn, sans avoir à itérer chat par chat.

| Param | Description |
| --- | --- |
| `account_id` | Filtrer par compte (recommandé) |
| `cursor` / `limit` | Pagination (max 250) |

```ts
const response = await client.messaging.getAllAttendees({
  account_id: "<account_id>",
  limit: 250,
})
// Filtrer is_self === 0 pour n'avoir que les prospects
```

---

## Lister tous les messages (tous chats confondus)

`GET /api/v1/messages`

Même structure de réponse que "Lister les messages d'une conversation", mais sans `chat_id` -- retourne tous les messages de tous les chats d'un ou plusieurs comptes.

**Pour Kaizen** : alternative au polling par chat. Utile en n8n pour récupérer en une seule requête tous les nouveaux messages arrivés depuis la dernière vérification, sur l'ensemble des conversations d'un client.

### Query params (LinkedIn)

| Param | Type | Description |
| --- | --- | --- |
| `account_id` | string | Filtrer par compte (recommandé, sinon retourne tous les comptes) |
| `after` | string | ISO 8601 UTC -- sync incrémentale |
| `before` | string | ISO 8601 UTC |
| `sender_id` | string | Filtrer par expéditeur |
| `cursor` | string | Pagination |
| `limit` | integer | 1-250 |

### Différence avec "Lister les messages d'une conversation"

| | Par chat | Tous chats |
| --- | --- | --- |
| Endpoint | `GET /api/v1/chats/:chat_id/messages` | `GET /api/v1/messages` |
| Scope | Un chat précis | Tous les chats du compte |
| Usage Kaizen | Charger l'historique d'une conversation | Polling global de nouveaux messages |

```ts
const response = await client.messaging.getAllMessages({
  account_id: "<account_id>",
  after: lastSyncTimestamp,
  limit: 250,
})
```

---

## Récupérer un message par son ID

`GET /api/v1/messages/:message_id`

Retourne un seul message. Même structure que les items de "Lister les messages" (voir section ci-dessus).

**Pour Kaizen** : utilisé dans les workflows n8n déclenchés par webhook -- quand Unipile notifie l'arrivée d'un nouveau message, il fournit un `message_id` ; ce endpoint permet de récupérer le contenu complet.

```ts
const message = await client.messaging.getMessage(message_id)
// message.text, message.is_sender, message.chat_id, message.sender_id
```

---

## Envoyer un message dans une conversation existante

`POST /api/v1/chats/:chat_id/messages`

> **Corps en `multipart/form-data`, pas JSON.**

Utilisé par n8n pour envoyer les réponses des agents (conversation, intent) dans une conversation déjà ouverte. Contrairement à "Start a new chat", le `chat_id` est déjà connu.

### Champs

| Champ | Requis | Description |
| --- | --- | --- |
| `chat_id` | oui (path) | ID Unipile de la conversation |
| `text` | non* | Contenu texte du message |
| `account_id` | non | Recommandé : empêche d'envoyer dans un chat d'un autre compte |
| `attachments` | non | Fichiers joints (binaire) |
| `quote_id` | non | ID d'un message pour répondre en citation |

*Au moins `text` ou `attachments` doit être fourni.

### Réponse 201

```json
{
  "object": "MessageSent",
  "message_id": "<message_id>"
}
```

### Erreurs 422 importantes

| Type | Cause |
| --- | --- |
| `errors/limit_exceeded` | Quota LinkedIn d'envoi dépassé |
| `errors/cant_send_message` | Envoi impossible (compte restreint, chat fermé) |
| `errors/too_many_requests` (429) | Rate limit LinkedIn, réessayer plus tard |

### SDK Node

```ts
const response = await client.messaging.sendMessage({
  chat_id: "<chat_id>",
  text: "Bonjour, suite à votre message...",
  account_id: "<account_id>",
})
// response.object === "MessageSent"
// response.message_id : string
```
