# Unipile - Index de documentation Kaizen

Lire ce fichier en premier pour savoir quel fichier consulter. Ne pas charger les autres fichiers sans raison.

## Quand lire quoi

| Je veux... | Lire |
| --- | --- |
| Lister / récupérer / connecter / reconnecter / supprimer un compte ; resync | [accounts.md](accounts.md) |
| Connecter un nouveau compte LinkedIn via Hosted Auth (notify_url) | [hosted-auth.md](hosted-auth.md) |
| Lister chats, lire/envoyer des messages LinkedIn | [messaging.md](messaging.md) |
| Écouter les événements en temps réel (webhooks) | [webhooks.md](webhooks.md) |
| Lister / envoyer des invitations LinkedIn ; réseau de connexions | [networking.md](networking.md) |

## Rappels critiques (toujours valables)

- **account_id** : ID Unipile d'un compte LinkedIn = clé de jointure dans toutes les tables `lk_*`
- **Dates** : toujours UTC strict avec `Z` final (`2025-12-31T23:59:59.999Z`). Un offset `+02:00` provoque une erreur Unipile "Expected union value"
- **Auth** : header `X-API-KEY` -- jamais côté client, toujours serveur (n8n ou server action Next.js)
- **Statut LinkedIn** : la vraie source de vérité est `sources[].status` sur le compte Unipile (`OK` / `CREDENTIALS` / `ERROR` / etc.), pas `is_active` dans Supabase
