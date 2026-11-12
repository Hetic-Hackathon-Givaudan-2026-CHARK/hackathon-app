# Hackathon App

Prototype de commande accompagnée pour les petites entreprises clientes de Givaudan (thématique 2) : le client décrit son besoin avec ses mots, reçoit trois références expliquées simplement, affine le profil, suit son projet, puis commande un échantillon gratuit ou demande un expert.

Stack : Node 24, Express 5 (TypeScript), Vite + TypeScript sans framework, PostgreSQL 17, un assistant IA local (Ollama et `llama3.2:1b` via l'API compatible `/chat/completions`, [ADR 0013](./docs/adr/0013-assistant-local-ollama.md)) et le service RAG de l'équipe Data appelé par l'API ([ADR 0008](./docs/adr/0008-integration-du-service-data.md)). Architecture du prototype : [ADR 0007](./docs/adr/0007-architecture-du-prototype.md). Contrat d'API : [`openapi.yaml`](./openapi.yaml).

Pour le détail et la justification des choix techniques, consultez le registre d'architecture : [docs/adr/](./docs/adr/).

---

## 1. Prérequis sur la machine hôte

- **Git**
- **Docker Desktop** (lancé et en cours d'exécution)
- **Visual Studio Code** avec l'extension **[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)**
- **[Ollama](https://ollama.com)** sur la machine hôte, avec le modèle de l'assistant : `ollama pull llama3.2:1b`. Le conteneur l'appelle par `host.docker.internal:11434`.
- L'**URL ngrok du service Data**, fournie par l'équipe Data.

Sans Ollama ni service Data, le prototype tourne quand même (voir la section 4).

---

## 2. Lancer l'environnement (Dev Container)

1. Clonez le dépôt et ouvrez le dossier dans VS Code :
   ```bash
   git clone git@github.com:Hetic-Hackathon-Givaudan-2026-CHARK/hackathon-app.git
   code hackathon-app
   ```
2. Lorsque l'invite apparaît (ou via `F1` / `Ctrl+Shift+P`), sélectionnez **Dev Containers: Reopen in Container**.
3. VS Code démarre la stack Docker (`compose.yaml`) et s'y connecte.
4. À la création, les dépendances `npm` sont installées et `api/.env` est copié depuis `api/.env.example`.

Tout se fait dans le dev container, jamais sur l'hôte Windows.

---

## 3. Configurer `api/.env`

Le fichier n'est jamais commité. Les valeurs par défaut sont dans [`api/.env.example`](./api/.env.example).

| Variable                 | Rôle                                                                                            | Valeur pour la démo                    |
| ------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| `DATABASE_URL`           | Connexion PostgreSQL                                                                            | `postgres://app:app@db:5432/app`       |
| `AI_BASE_URL`            | API compatible `/chat/completions` : Ollama sur l'hôte                                          | `http://host.docker.internal:11434/v1` |
| `AI_MODEL`               | Modèle de l'assistant                                                                           | `llama3.2:1b`                          |
| `AI_API_KEY`             | Inutile avec Ollama                                                                             | vide                                   |
| `AI_TIMEOUT_MS`          | Attente maximale du LLM, relance comprise, avant le repli sur les textes des fiches             | `30000`                                |
| `DATA_API_URL`           | URL ngrok du service Data, sans `/docs` ni `/` final, à recopier à chaque redémarrage du tunnel | fournie par l'équipe Data              |
| `DATA_API_TIMEOUT_MS`    | Délai maximal d'un appel au service Data                                                        | `8000`                                 |
| `DEMO_SHIPPING_DELAY_MS` | Simulation de démo : délai avant qu'un échantillon commandé passe à « expédié » (0 = jamais)    | `6000`                                 |

Le service Data vit dans un dépôt séparé : [Hetic-Hackathon-Givaudan-2026-CHARK/equipe10](https://github.com/Hetic-Hackathon-Givaudan-2026-CHARK/equipe10). Son contrat est copié dans [`docs/contrats/data-api.openapi.json`](./docs/contrats/data-api.openapi.json).

---

## 4. Lancer l'application

Dans un terminal du conteneur :

```bash
npm run dev
```

- **Interface Web :** [http://localhost:5173](http://localhost:5173)
- **API :** [http://localhost:3000](http://localhost:3000)
- **PostgreSQL :** `localhost:5432` (utilisateur `app`, mot de passe `app`, base `app`)

Sous Windows, les changements de fichiers ne sont pas toujours détectés dans le conteneur : après un `git pull` ou un changement de branche, arrêtez puis relancez `npm run dev`.

### Parcours de démo

1. Ouvrez [http://localhost:5173](http://localhost:5173) et choisissez **Continuer en tant que Léa** (NutriPeak Foods, `CL-002`).
2. **Besoin** : décrivez le projet, par exemple « Un arôme vanille-caramel sans sucre ajouté pour ma boisson protéinée ».
3. **Propositions** : trois références avec leur pourcentage de correspondance, leurs badges, « En clair » et « Pourquoi cette référence ? ». Choisissez-en une.
4. **Affinage** : trois réglages (frais ou chaud, douceur, naturalité), la synthèse se met à jour tout de suite.
5. **Suivi** : la frise du projet et « Mes projets enregistrés ».
6. **Échantillon** : « Commander mon échantillon gratuit ». La frise passe à « expédié » après quelques secondes : c'est une simulation de démo, il n'y a pas de logistique derrière.

Pour montrer le cloisonnement ([ADR 0011](./docs/adr/0011-comptes-de-demo-et-cloisonnement.md)) : **Changer de compte**, puis **Continuer en tant que Marc** (Maison Éclat, `CL-001`). Sa liste de projets est différente, et aucun projet de Léa n'est accessible.

### Comment l'assistant choisit et explique

La recherche sémantique du service Data et les mots du brief classent les références de l'univers ; le LLM local rédige seulement « Pourquoi cette référence ? » pour les 3 premières ([ADR 0013](./docs/adr/0013-assistant-local-ollama.md)). Sur un poste sans GPU, comptez de 10 à 30 s après « Voir mes propositions ».

### Si Ollama ou le service Data ne répondent pas

La démo continue ([ADR 0012](./docs/adr/0012-repli-propositions-figees.md)) :

- sans Ollama, les 3 références restent classées et chaque carte garde un texte tiré de sa fiche ;
- sans service Data, le classement repose sur les mots du brief.

Le journal de l'API indique `Assistant : N/3 explications` ou `Explications tirées des fiches`, et `/api/health` renvoie `data: "ok"` ou `"indisponible"`. Pour ne pas attendre `AI_TIMEOUT_MS` quand Ollama est arrêté, videz `AI_BASE_URL`.

### Données de test

Le schéma et le seed de `db/init/` ne sont joués qu'au premier démarrage de PostgreSQL. Pour repartir d'une base propre avant une démo (efface tous les projets créés) :

```bash
npm run db:reset -w api
```

Le seed est généré à partir des CSV de l'équipe Data, pour que les identifiants (`CL-…`, `PR-…`) soient les mêmes des deux côtés :

```bash
git clone https://github.com/Hetic-Hackathon-Givaudan-2026-CHARK/equipe10 .scratch/equipe10
npm run db:generate-seed -w api
```

---

## 5. Vérifier la chaîne complète

1. **API, base et service Data :** [http://localhost:3000/api/health](http://localhost:3000/api/health) doit répondre `{"status":"ok", "db": "…", "data": "ok"}` (`"indisponible"` si le tunnel ngrok est coupé).
2. **Session et cloisonnement :**
   ```bash
   curl -c lea.txt -X POST localhost:3000/api/session -H 'Content-Type: application/json' -d '{"account":"lea"}'
   curl -b lea.txt localhost:3000/api/projects     # les 3 projets de démo de Léa
   curl -c marc.txt -X POST localhost:3000/api/session -H 'Content-Type: application/json' -d '{"account":"marc"}'
   curl -b marc.txt localhost:3000/api/projects/0b6f3a52-8c1d-4e7a-9f20-000000000201   # projet de Léa : 404
   ```
3. **Assistant :** déroulez le parcours de démo ci-dessus et regardez le journal de l'API.

---

## 6. Workflow de contribution (GitFlow & Qualité)

- **Branche principale de travail :** `develop`
- **Branches protégées :** les push directs sur `main` et `develop` sont refusés par les règles du dépôt.
- **Pour toute contribution :**
  1. Créez une branche dédiée : `git checkout -b feature/ma-fonctionnalite develop`
  2. Si l'API change, modifiez d'abord `openapi.yaml`, dans la même PR.
  3. Validez le code localement :
     ```bash
     npm run lint
     npm run format:check
     npm run build
     ```
  4. Committez vos modifications (le hook Husky `pre-commit` bloque tout code non conforme).
  5. Poussez votre branche et ouvrez une Pull Request vers `develop`.
  6. La PR ne peut être fusionnée que si le check CI (`qualite`) est au vert.
