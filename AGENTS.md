# AGENTS.md

Hackathon Givaudan, thématique 2 : une plateforme de commande BtoB conversationnelle (arômes, parfums, échantillons, réassorts). Stack actuelle : Node 24, Express (TypeScript), Vite, PostgreSQL 17. Vue d'ensemble dans `README.md`, contrat d'API dans `openapi.yaml`.

## Lancer

- Tout se fait dans le dev container, jamais sur l'hôte Windows (`node_modules` y contient des binaires Linux).
- `npm run dev` : API (port 3000) et front Vite (port 5173).
- Avant de committer : `npm run lint` puis `npm run format:check`. Le hook `pre-commit` (Husky + lint-staged) et la CI (job `qualite`) refusent le code non conforme.
- `npm run build` doit passer : la CI le lance.

## Règles

- Chemins : API dans `api/src/`, front dans `web/src/`, schéma et données de test dans `db/init/` (joués uniquement au premier démarrage de PostgreSQL : pour les rejouer, supprimer `db/data/`).
- Le contrat d'API est `openapi.yaml`. On le modifie avant le code, dans la même PR.
- Fins de ligne LF (`.gitattributes`). Secrets dans `api/.env`, jamais commités.
- GitFlow : branches `feature/*` depuis `develop`, PR vers `develop`, `main` et `develop` protégées.
- Le plan d'un travail va dans son ticket (section « Plan » à cocher), pas dans un `TASKS.md` commité. Les brouillons vont dans `.scratch/`, ignoré par git.
- Les tickets suivent les formulaires de `.github/ISSUE_TEMPLATE/` (Story, Tâche, Spike, Bug). Une PR qui termine un ticket contient `Closes #N`.

## Décisions

- Lis `docs/adr/` avant d'ajouter une dépendance ou de changer de composant.
- Ne contredis pas un ADR au statut « acceptée ».
- S'il faut en changer, propose un nouvel ADR, puis arrête-toi. L'ADR remplacé passe à « remplacée par NNNN ».
- Les ADR 0001 à 0004 viennent du cours (démo) ; les choix propres au projet commencent à l'ADR 0005.

## À ne pas faire

- Contourner les contrôles (`--no-verify`, désactiver une règle ESLint).
- Installer des dépendances hors du dev container.
- Mélanger les parcours Parfums (fragrances) et Arômes (flavors) : le défi exige de les distinguer.
- Envoyer des données clients réelles ou confidentielles à un service d'IA externe.
- Committer sur `main` ou `develop` directement.
