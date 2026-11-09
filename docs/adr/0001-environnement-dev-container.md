# 0001. Environnement standardisé via Dev Container et Docker Compose

- Statut : acceptée
- Date : 2026-11-05
- Décideurs : Tech-Lead & Équipe

## Contexte

L'équipe travaille sur des systèmes d'exploitation différents (Windows avec WSL2, macOS, Linux). L'objectif est d'éliminer le problème récurrent du _"ça marche sur ma machine"_ et de permettre à un nouvel arrivant d'être opérationnel immédiatement sans configurer manuellement ses outils locaux.

## Options

1. **Dev Container Docker Compose (retenue) :** Environnement Debian standardisé contenant Node.js 24, Git, la CLI GitHub, et les extensions VS Code obligatoires (ESLint, Prettier).
2. **Installation locale directe :** Chaque membre installe Node, PostgreSQL et les linters sur sa machine hôte. Risque élevé de divergence de versions (Node/Postgres) et perte de temps en configuration.

## Décision

Nous choisissons le **Dev Container orchestré par Docker Compose** (`.devcontainer/devcontainer.json` + `compose.yaml`).

## Conséquences

- Positives : Environnement strictement identique pour tous les développeurs et la CI ; validation immédiate du _test du nouvel arrivant_.
- Négatives à accepter : Dépendance à Docker Desktop et légers besoins en ressources mémoire/CPU.
- À revoir si : Les postes de travail ne disposent pas des capacités de virtualisation requises.
