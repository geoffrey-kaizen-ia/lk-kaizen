# Unipile - Webhooks

Unipile pousse des événements en temps réel vers une URL configurée. Un seul webhook peut écouter plusieurs événements et plusieurs comptes.

---

## Configuration

Un webhook Unipile se configure via `POST /api/v1/webhooks` ou dans le dashboard Unipile.

| Champ | Description |
|---|---|
| `request_url` | URL n8n qui reçoit les événements |
| `events` | Liste des événements écoutés |
| `account_ids` | Comptes LinkedIn concernés (vide = tous) |
| `format` | `json` (toujours utiliser json) |
| `headers` | Headers optionnels (ex: auth token) |

---

## Événement : `new_relation`

Se déclenche quand une invitation LinkedIn est acceptée (dans les deux sens).

**Pour Kaizen** : c'est le trigger du workflow icebreaker. Quand Unipile pousse cet événement, n8n démarre le flow : profil → résumé → message icebreaker.

### Payload reçu par n8n

```json
{
  "account_id": "DHmKsuGuSwuJcsRjYV77qg",
  "account_type": "LINKEDIN",
  "webhook_name": "kaizen-new-relation",
  "timestamp": "2026-06-09T10:00:00.000Z",
  "user_provider_id": "ACoAABPs1HoBOWLqfKBfc-up0T9CUqFq5Row4As",
  "user_full_name": "Farid Tayebi",
  "user_public_identifier": "farid-tayebi",
  "user_profile_url": "https://www.linkedin.com/in/farid-tayebi",
  "user_picture_url": "https://media.licdn.com/dms/image/..."
}
```

### Champs clés pour Kaizen

| Champ | Usage |
|---|---|
| `account_id` | Identifie le client (jointure avec `lk_clients_config.account_id`) |
| `user_provider_id` | LinkedIn ID du prospect = `lk_prospects.linkedin_id` |
| `user_full_name` | Nom du prospect |
| `user_profile_url` | URL LinkedIn du prospect |
| `user_picture_url` | Photo de profil |

---

## Événement : `message_received`

Se déclenche quand un message LinkedIn est reçu sur un compte connecté.

**Pour Kaizen** : trigger du workflow conversation. Quand un prospect répond, n8n récupère l'historique et génère la réponse avec l'agent `conversation`.

### Payload reçu par n8n

```json
{
  "account_id": "DHmKsuGuSwuJcsRjYV77qg",
  "account_type": "LINKEDIN",
  "webhook_name": "kaizen-message-received",
  "timestamp": "2026-06-09T10:05:00.000Z",
  "chat_id": "chat_abc123",
  "message_id": "msg_xyz789",
  "message": "Bonjour, merci pour votre message !",
  "sender": {
    "provider_id": "ACoAABPs1HoBOWLqfKBfc-up0T9CUqFq5Row4As",
    "name": "Farid Tayebi"
  },
  "is_sender": false
}
```

### Champs clés pour Kaizen

| Champ | Usage |
|---|---|
| `account_id` | Identifie le client |
| `chat_id` | ID de la conversation = `lk_prospects.chat_id` |
| `message_id` | ID du message = `lk_messages.message_id` (dédup) |
| `message` | Contenu du message reçu |
| `sender.provider_id` | LinkedIn ID du prospect |
| `is_sender` | `false` = message reçu (inbound), `true` = envoyé par le client |

---

## Créer un webhook via API

```bash
POST /api/v1/webhooks
X-API-KEY: <votre_clé>

{
  "name": "kaizen-new-relation",
  "request_url": "https://n8n.srv1213804.hstgr.cloud/webhook/unipile-new-relation",
  "format": "json",
  "events": ["new_relation"],
  "account_ids": []
}
```

`account_ids: []` = s'applique à tous les comptes connectés (recommandé pour multi-clients).
