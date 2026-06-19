# Unipile - Recherche LinkedIn (Search)

Endpoint de recherche LinkedIn : permet d'interroger LinkedIn Classic, Sales Navigator ou Recruiter pour trouver des profils, entreprises, offres d'emploi ou posts — exactement comme une recherche manuelle dans le navigateur, mais automatisable.

**Prérequis** : le compte LinkedIn du client doit avoir l'abonnement correspondant (Classic pour les recherches standard, Sales Navigator ou Recruiter pour les recherches avancées).

---

## Deux endpoints

| Endpoint | Usage |
| --- | --- |
| `GET /api/v1/linkedin/search/parameters` | Résoudre un texte (ville, secteur, école...) en ID numérique exploitable |
| `POST /api/v1/linkedin/search` | Lancer la recherche avec les paramètres |

---

## Étape 1 — Résoudre les IDs (si besoin)

`GET /api/v1/linkedin/search/parameters`

Certains filtres (localisation, secteur, compétence, école, entreprise) nécessitent un ID interne LinkedIn, pas un texte libre. Cet endpoint permet de chercher l'ID correspondant à un texte.

### Query params

| Param | Requis | Description |
| --- | --- | --- |
| `account_id` | oui | Compte LinkedIn du client |
| `type` | oui | Type de paramètre : `LOCATION`, `INDUSTRY`, `SCHOOL`, `SKILL`, `COMPANY`... |
| `keywords` | oui | Texte à rechercher (ex: `bretagne`, `énergie renouvelable`) |
| `limit` | non | Nb de résultats (défaut 100) |

### Exemple : trouver l'ID de "Bretagne"

```bash
GET /api/v1/linkedin/search/parameters
  ?account_id=<account_id>
  &type=LOCATION
  &keywords=bretagne
  &limit=100
```

### Réponse

```json
{
  "object": "LinkedinSearchParametersList",
  "items": [
    {
      "object": "LinkedinSearchParameter",
      "title": "Bretagne, France",
      "id": "102748797"
    },
    {
      "object": "LinkedinSearchParameter",
      "title": "Finistère, Bretagne, France",
      "id": "104246759"
    }
  ],
  "paging": { "page_count": 2 }
}
```

> Répéter pour chaque dimension filtrée : villes de Bretagne, secteurs (ENR, maritime, agroalimentaire...), fonctions/industries.

---

## Étape 2 — Lancer la recherche

`POST /api/v1/linkedin/search?account_id=<account_id>`

### Méthode A : copier-coller l'URL LinkedIn

La façon la plus rapide. Faire la recherche dans le navigateur, copier l'URL, l'envoyer telle quelle.

```json
{
  "url": "https://www.linkedin.com/search/results/people/?keywords=directeur+général&geoUrn=%5B%22102748797%22%5D"
}
```

Fonctionne aussi avec les URLs Sales Navigator (`/sales/search/people?...`) ou les listes de leads sauvegardées.

### Méthode B : paramètres structurés

Plus contrôlable pour l'automatisation. Exemples ci-dessous.

---

## Exemples de recherches (cas ATIL)

### Recherche de personnes — LinkedIn Classic

Chercher des DG/DirCom/DRH en Bretagne (IDs de localisation résolus à l'étape 1).

```json
{
  "api": "classic",
  "category": "people",
  "keywords": "directeur général OR DirCom OR DRH OR responsable communication OR responsable RH",
  "location": [102748797, 104246759]
}
```

### Recherche de personnes — Sales Navigator (si le client a le compte)

Filtrage par fonction, secteur, localisation, ancienneté au poste.

```json
{
  "api": "sales_navigator",
  "category": "people",
  "keywords": "événementiel OR communication OR RSE",
  "location": [{ "id": 102748797 }],
  "tenure": [{ "min": 1 }]
}
```

### Recherche d'entreprises par secteur + localisation

Trouver les entreprises ENR, maritime ou agroalimentaire en Bretagne/Grand Ouest.

```json
{
  "api": "classic",
  "category": "companies",
  "industry": { "include": ["<id_secteur_energie>", "<id_secteur_maritime>"] },
  "location": [102748797]
}
```

### Recherche de posts (signaux événementiels)

Détecter des signaux d'opportunité : inauguration, anniversaire, convention, séminaire.

```json
{
  "api": "classic",
  "category": "posts",
  "keywords": "inauguration OR anniversaire OR séminaire OR convention OR \"portes ouvertes\"",
  "location": [102748797]
}
```

---

## Structure de la réponse (People)

```json
{
  "object": "LinkedinSearch",
  "items": [
    {
      "type": "PEOPLE",
      "id": "ACoAAA...",
      "name": "Prénom Nom",
      "first_name": "Prénom",
      "last_name": "Nom",
      "member_urn": "urn:li:member:123456",
      "public_identifier": "prenom-nom-xxx",
      "public_profile_url": "https://www.linkedin.com/in/prenom-nom-xxx",
      "network_distance": "DISTANCE_2",
      "location": "Rennes, Bretagne, France",
      "headline": "DG @ Coopérative Agricole du Finistère",
      "pending_invitation": false,
      "current_positions": [
        {
          "company": "Coopérative Agricole du Finistère",
          "role": "Directeur Général",
          "tenure_at_role": { "years": 3 }
        }
      ]
    }
  ],
  "paging": {
    "start": 0,
    "page_count": 10,
    "total_count": 1000
  },
  "cursor": "<cursor_pour_pagination>"
}
```

### Champs clés pour Kaizen

| Champ | Usage |
| --- | --- |
| `id` | LinkedIn member_id = `lk_prospects.linkedin_id` (à passer à l'invitation) |
| `public_identifier` | Identifiant URL (`prenom-nom-xxx`) |
| `name` / `first_name` / `last_name` | Nom complet |
| `headline` | Poste actuel = enrichissement `lk_prospects` |
| `location` | Ville/région du prospect |
| `current_positions[0].role` | Titre du poste pour confirmer le ciblage |
| `network_distance` | `DISTANCE_1` = déjà connecté, `DISTANCE_2/3` = à inviter |
| `cursor` | Pagination — à passer à la prochaine requête pour la page suivante |

### Structure de la réponse (Posts)

```json
{
  "type": "POST",
  "social_id": "urn:li:activity:7236734771807019010",
  "share_url": "https://www.linkedin.com/posts/...",
  "parsed_datetime": "2024-09-03T14:02:20.213Z",
  "text": "Nous inaugurons notre nouveau site de production...",
  "reaction_counter": 42,
  "comment_counter": 8
}
```

> Pour les posts, utiliser `social_id` pour identifier l'auteur et déclencher une invitation ciblée.

---

## Pagination

Toutes les recherches sont paginées. Passer le `cursor` reçu dans la réponse pour obtenir la page suivante :

```json
{
  "api": "classic",
  "category": "people",
  "keywords": "directeur général",
  "location": [102748797],
  "cursor": "<valeur_cursor_precedente>"
}
```

---

## Limites LinkedIn à surveiller

- LinkedIn impose des limites de volume sur les recherches (non documentées précisément par Unipile — vérifier les conditions Unipile).
- Sales Navigator et Recruiter donnent accès à des filtres plus fins et des volumes plus élevés que Classic.
- Les recherches Classic sont anonymisées au-delà des 1000 premiers résultats (LinkedIn bloque la pagination totale).
- Respecter les CGU LinkedIn : pas de scraping massif en rafale.

---

## Intégration dans le pipeline Kaizen

Flux recommandé pour alimenter `lk_prospects` automatiquement :

1. **Résolution des IDs** (une fois) : appeler `/search/parameters` pour chaque ville/secteur cible → stocker les IDs.
2. **Recherche** (cron ou manuel) : lancer `/linkedin/search` avec les paramètres et récupérer les `id` (member_id) + `headline` + `location`.
3. **Déduplication** : vérifier que le `linkedin_id` n'existe pas déjà dans `lk_prospects` pour ce `account_id`.
4. **Import** : insérer dans `lk_prospects` avec `status = 'to_invite'` et les champs d'enrichissement disponibles (`full_name`, `headline` → `job_title`).
5. **Outreach** : le workflow Icebreaker n8n prend le relais en lisant les prospects `to_invite`.

> **Point d'attention** : l'`id` retourné par la recherche People (ex: `ACoAAA...`) est bien le `provider_id` à utiliser dans `POST /api/v1/users/invite`. Vérifier selon le mode (Classic vs Sales Navigator) car le format peut différer légèrement.
