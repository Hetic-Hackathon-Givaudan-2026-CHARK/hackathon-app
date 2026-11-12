# 0014. La tranche verticale se lance avec `docker compose up`, sur un seul port

- Statut : acceptée
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

Le jalon m2 (vendredi 13 novembre) exige que « `docker compose up` lance une tranche complète, de l'écran aux données ». L'évaluateur la teste sur place, avant le pitch. Jusqu'ici, `compose.yaml` ne démarre que le dev container (`sleep infinity`) et PostgreSQL ; l'application se lance à la main dans le dev container avec `npm run dev`, qui sert le front sur le port 5173 (Vite) et l'API sur le 3000. [0007](0007-architecture-du-prototype.md) prévoyait une démo dans le dev container. Ollama tourne sur la machine hôte ([0013](0013-assistant-local-ollama.md)), le service Data derrière un tunnel ngrok ([0008](0008-integration-du-service-data.md)).

## Options

1. **Lancer `npm run dev` dans un service compose :** rien à construire, mais le serveur de développement de Vite et `tsx watch` en démonstration, deux ports, et `node_modules` partagé avec l'hôte Windows.
2. **Une image qui construit l'API et le front, et l'API sert les deux sur un port (retenue) :** ce que l'on livrerait en V1 ; une seule URL, pas de CORS ni de proxy ; une construction d'environ une minute au premier lancement.
3. **Deux services (API Node, front servi par nginx) :** plus proche d'une production découpée, mais une image et une configuration de plus, pour le même résultat ce soir.

## Décision

Nous choisissons l'option 2.

- `Dockerfile` à la racine, sur `node:24-trixie` comme la CI : `npm ci`, `npm run build`, puis `node api/dist/index.js`.
- L'API sert `web/dist` quand il existe (`express.static`). En développement, rien ne change : Vite sert le front.
- Service `app` dans `compose.yaml`, publié sur **http://localhost:8080** (le 3000 et le 5173 restent au dev container). Il attend que PostgreSQL soit prêt et joint Ollama par `host.docker.internal`.
- La configuration (`DATA_API_URL`, `AI_*`) vient de `api/.env`, lu au démarrage (`env_file`, facultatif) et jamais copié dans l'image (`.dockerignore`). Sans ce fichier, les replis de [0012](0012-repli-propositions-figees.md) s'appliquent : c'est le mock demandé quand une dépendance Data manque.
- `docker compose up` se lance depuis l'hôte, dans le dossier du dépôt, pas dans le dev container (qui n'a pas accès à Docker).

## Conséquences

- Positives : une seule commande pour l'évaluateur ; l'image préfigure le déploiement de la V1 ; aucune dépendance npm ajoutée.
- Négatives, à accepter : `docker compose up` construit aussi le dev container ; une image à reconstruire après chaque changement (`docker compose up --build`) ; Ollama et le tunnel Data restent hors de compose.
- À revoir si : la V1 est hébergée (HTTPS, secrets gérés par l'hébergeur), ou si Ollama passe dans un service compose.
