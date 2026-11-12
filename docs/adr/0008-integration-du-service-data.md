# 0008. Le service RAG de l'équipe Data est appelé en HTTP par l'API, avec un repli local

- Statut : acceptée
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

L'équipe Data livre un service FastAPI dans le dépôt `Hetic-Hackathon-Givaudan-2026-CHARK/equipe10` : base vectorielle ChromaDB, embeddings `nomic-embed-text`, LLM local `qwen2.5:1.5b` via Ollama, données synthétiques (clients, produits, matières premières, commandes, échantillons). Il expose `/health`, `/search`, `/ask` et `/demo/ping`, documentés par Swagger sur `/docs`, et tourne sur un poste de l'équipe derrière un tunnel ngrok gratuit. L'URL ngrok change à chaque redémarrage et le poste peut s'éteindre.

Constats du 2026-11-12 en appelant le service (embeddings `qwen3-embedding:4b`, LLM `qwen2.5:1.5b`, 25 documents indexés) :

- `POST /search` répond en 3 à 5 s à travers ngrok.
- La pertinence est bonne (« boisson protéinée vanille » renvoie d'abord le produit `PR-007`).
- Les champs `section` et `document_type` valent toujours `Introduction` et `unknown` : l'identifiant de l'entité n'apparaît que dans le texte (`Chapter 12: product_PR-007`).
- La recherche renvoie les commandes et échantillons de **tous** les clients : une question de Marc fait remonter des commandes d'autres entreprises.

## Options

1. **Appel HTTP serveur à serveur depuis l'API Express (retenue) :** les deux dépôts restent indépendants, chacun dans sa langue. Le seul lien est un contrat OpenAPI.
2. **Sous-module Git ou fusion des dépôts :** tout au même endroit, mais Python et Node dans le même dev container, une CI à refaire et des conflits à quelques heures du rendu.
3. **Utiliser `/ask` du service Data pour générer la réponse finale :** aucun LLM côté app, mais un modèle de 1,5 milliard de paramètres comprend mal un brief client (voir [0006](0006-fournisseur-ia-assistant-de-commande.md)) et ne renvoie pas un format exploitable par l'interface.

## Décision

Nous choisissons l'option 1, en n'utilisant que la recherche :

- L'API appelle `POST {DATA_API_URL}/search` pour récupérer les passages pertinents (fiches produit, historique, documents), puis passe ces passages au LLM de [0009](0009-fournisseur-llm-mistral.md), qui rédige la réponse.
- `DATA_API_URL` est une variable d'environnement dans `api/.env`. Chaque appel envoie l'en-tête `ngrok-skip-browser-warning: true`, sinon ngrok renvoie sa page d'avertissement au lieu du JSON.
- Délai maximal de 8 s par appel. En cas d'échec, l'assistant répond quand même à partir du catalogue PostgreSQL seul, et `/api/health` indique `data: "indisponible"`.
- Le contrat du service Data est copié dans [`docs/contrats/data-api.openapi.json`](../contrats/data-api.openapi.json) et mis à jour à chaque changement côté Data.
- **Cloisonnement :** l'API ne transmet au LLM que les passages de type produit ou matière première, et les commandes ou échantillons dont l'identifiant client (`CL-…`) est celui de la session. Tout passage dont le client est inconnu est écarté. Le filtrage se fait sur le texte tant que le service Data ne renvoie pas de métadonnées fiables.
- **Même jeu de données :** le seed PostgreSQL (`db/init/002-seed.sql`) est généré à partir des CSV de `equipe10/data/raw/`, pour que les identifiants (`CL-…`, `PR-…`, `ORD-…`) soient les mêmes des deux côtés.

## Conséquences

- Positives : aucune dépendance de build entre les dépôts ; la démo survit à une coupure du tunnel ; chaque équipe garde son outillage.
- Négatives, à accepter : une copie du contrat à tenir à jour ; latence réseau supplémentaire ; l'URL ngrok doit être recopiée dans `.env` à chaque redémarrage du tunnel.
- À revoir si : le service Data est hébergé à une adresse stable, ou s'il renvoie les métadonnées (`document_type`, `client_id`, `product_id`, `domain`) et accepte un filtre par client : le filtrage sur le texte serait alors supprimé.
