# Registre des Décisions d'Architecture (ADR)

Ce document consigne les décisions techniques majeures prises pour le projet **hackathon-app**, leur contexte, les alternatives écartées et leurs conséquences.

---

## ADR 0001 : Environnement standardisé via Dev Container et Docker Compose

- **Statut :** Acceptée
- **Date :** 2026-11-05
- **Décideurs :** Tech-Lead & Équipe

### Contexte

L'équipe travaille sur des systèmes d'exploitation différents (Windows avec WSL2, macOS, Linux). L'objectif est d'éliminer le problème récurrent du _"ça marche sur ma machine"_ et de permettre à un nouvel arrivant d'être opérationnel immédiatement sans configurer manuellement ses outils locaux.

### Options

1. **Dev Container Docker Compose (retenue) :** Environnement Debian standardisé contenant Node.js 24, Git, la CLI GitHub, et les extensions VS Code obligatoires (ESLint, Prettier).
2. **Installation locale directe :** Chaque membre installe Node, PostgreSQL et les linters sur sa machine hôte. Risque élevé de divergence de versions (Node/Postgres) et perte de temps en configuration.

### Décision

Nous choisissons le **Dev Container orchestré par Docker Compose** (`.devcontainer/devcontainer.json` + `compose.yaml`).

### Conséquences

- **Positives :** Environnement strictement identique pour tous les développeurs et la CI ; validation immédiate du _test du nouvel arrivant_.
- **Négatives à accepter :** Dépendance à Docker Desktop et légers besoins en ressources mémoire/CPU.
- **À revoir si :** Les postes de travail ne disposent pas des capacités de virtualisation requises.

---

## ADR 0002 : Base de données relationnelle PostgreSQL 17

- **Statut :** Acceptée
- **Date :** 2026-11-05
- **Décideurs :** Tech-Lead & Équipe

### Contexte

L'application doit persister les questions posées, les réponses générées par l'IA et les métadonnées associées. L'API backend et les éventuels scripts d'analyse de données doivent pouvoir accéder aux données simultanément.

### Options

1. **PostgreSQL 17 (retenue) :** SGBD relationnel robuste, support natif du format JSON, extensions vectorielles possibles (ex: `pgvector`), conteneur officiel disponible.
2. **SQLite :** Très léger sans conteneur, mais supporte mal les accès concurrents simultanés (API + scripts) et moins représentatif d'une architecture de production.
3. **MongoDB :** Documentaire, mais les données prévues possèdent des relations fortes et l'équipe maîtrise SQL.

### Décision

Nous choisissons **PostgreSQL 17** démarré comme service dans `compose.yaml` avec persistance locale dans `./db/data` et scripts d'initialisation dans `./db/init`.

### Conséquences

- **Positives :** Prêt pour la production, persistance isolée, compatible avec les outils d'inspection SQL (TablePlus, DBeaver via le port exposé `5432`).
- **Négatives à accepter :** Nécessite un conteneur dédié avec healthcheck avant de lancer l'API.
- **À revoir si :** L'hébergement final de production impose une base de données cloud managée spécifique.

---

## ADR 0003 : Fournisseur d'IA en local avec Ollama (Llama 3.2 1B)

- **Statut :** Acceptée
- **Date :** 2026-11-05
- **Décideurs :** Tech-Lead & Équipe

### Contexte

Le projet requiert une fonctionnalité de réponse intelligente à des questions. Les contraintes du hackathon imposent :

- Un budget de **0 €** (aucun coût récurrent par requête).
- Une sécurité maximale (aucune fuite de clés API secrètes sur GitHub).
- La capacité de développer et tester hors-ligne sans dépendance à des quotas ou pannes d'API tierces.

### Options

1. **Ollama en local sur l'hôte (retenue) :** Modèle `llama3.2:1b` (ou `mistral`), gratuit, accessible depuis le conteneur via `host.docker.internal:11434`.
2. **API Cloud commerciale (OpenAI GPT-4o, Mistral API, Claude) :** Réponses de très haute qualité, mais nécessite un moyen de paiement, une gestion sécurisée de clés d'API (risques de fuite de secrets), et introduit une dépendance réseau.

### Décision

Nous choisissons **Ollama hébergé sur la machine hôte** avec une route d'API générique utilisant l'interface standard compatible OpenAI (`/v1/chat/completions`). Une simple variable d'environnement (`AI_BASE_URL` et `AI_API_KEY`) permettra de basculer vers un fournisseur cloud en production si nécessaire.

### Conséquences

- **Positives :** Coût financier nul, zéro quota, confidentialité absolue des données, fonctionnement autonome.
- **Négatives à accepter :** La qualité de génération d'un modèle léger 1B est inférieure à celle d'un modèle frontière (frontier model) ; le temps de réponse dépend du GPU/CPU local.
- **À revoir si :** La logique métier nécessite des capacités de raisonnement complexes que le modèle 1B ne peut satisfaire.

---

## ADR 0004 : Architecture Monorepo avec npm Workspaces

- **Statut :** Acceptée
- **Date :** 2026-11-05
- **Décideurs :** Tech-Lead & Équipe

### Contexte

Le projet combine un backend d'API (`api`) et une application web (`web`). Pour un hackathon d'équipe de courte durée, synchroniser les modifications entre deux dépôts GitHub distincts crée des frictions inutiles.

### Options

1. **Monorepo avec npm workspaces (retenue) :** Un seul dépôt Git, un seul `npm install`, outillage partagé (ESLint, Prettier, Husky, GitHub Actions).
2. **Polyrepo (deux dépôts distincts) :** Séparation stricte des responsabilités, mais double gestion de branches, de PRs, et désynchronisation fréquente entre l'API et le front.

### Décision

Nous choisissons le **Monorepo géré avec npm workspaces** avec deux sous-projets : `api` (Express + TS) et `web` (Vite + TS).

### Conséquences

- **Positives :** Un seul clone, scripts unifiés (`npm run dev`, `npm run lint`), PRs atomiques modifiant à la fois l'API et le frontend.
- **Négatives à accepter :** Nécessite une rigueur sur l'installation des dépendances (`-w api` ou `-w web`).
- **À revoir si :** L'équipe grandit et requiert des pipelines de déploiement totalement indépendants.
