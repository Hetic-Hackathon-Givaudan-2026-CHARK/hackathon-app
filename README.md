# Hackathon App

Environnement de développement prêt pour la production basé sur les Dev Containers VS Code.  
Stack full-stack : Node 24, Express (TypeScript), Vite + Vanilla/TS, PostgreSQL 17 et un assistant IA (API cloud compatible `/chat/completions`, voir [ADR 0006](./docs/adr/0006-fournisseur-ia-assistant-de-commande.md) ; la démo actuelle tourne encore sur Ollama en local).

Pour le détail et la justification des choix techniques, consultez le registre d'architecture : [docs/adr/](./docs/adr/).

---

## 1. Prérequis sur la machine hôte

Avant de démarrer, installez sur votre machine hôte :

- **Git**
- **Docker Desktop** (lancé et en cours d'exécution)
- **Visual Studio Code** avec l'extension **[Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)**
- **Ollama** (pour l'IA en local) :
  ```bash
  # Télécharger et démarrer le modèle requis
  ollama run llama3.2:1b
  ```

---

## 2. Lancer l'environnement (Dev Container)

1. Clonez le dépôt et ouvrez le dossier dans VS Code :
   ```bash
   git clone git@github.com:Hetic-Hackathon-Givaudan-2026-CHARK/hackathon-app.git
   code hackathon-app
   ```
2. Lorsque l'invite apparaît (ou via `F1` / `Ctrl+Shift+P`), sélectionnez **Dev Containers: Reopen in Container**.
3. VS Code démarre automatiquement la stack Docker (`compose.yaml`) et s'y connecte.
4. À la création, les dépendances `npm` et le fichier de configuration `api/.env` sont initialisés automatiquement.

---

## 3. Lancer l'application

Ouvrez un terminal dans VS Code (dans le conteneur) et lancez :

```bash
npm run dev
```

Cette commande exécute simultanément l'API Express et le frontend Vite.

### Points d'accès :

- **Interface Web :** [http://localhost:5173](http://localhost:5173)
- **API Backend :** [http://localhost:3000](http://localhost:3000)
- **Base de données PostgreSQL :** `localhost:5432` (User: `app`, Mot de passe: `app`, Base: `app`)

---

## 4. Vérifier la chaîne complète

1. **Vérifier l'API :** Ouvrez [http://localhost:3000/api/health](http://localhost:3000/api/health) (doit répondre `{"status":"ok"}`).
2. **Vérifier PostgreSQL :** Ouvrez [http://localhost:3000/api/db](http://localhost:3000/api/db) (retourne les données de test insérées à l'initialisation).
3. **Vérifier l'IA :** Ouvrez [http://localhost:5173](http://localhost:5173), saisissez une question dans le champ de texte et cliquez sur **Envoyer** : la réponse d'Ollama s'affiche en direct.

---

## 5. Workflow de contribution (GitFlow & Qualité)

- **Branche principale de travail :** `develop`
- **Branches protégées :** Les push directs sur `main` et `develop` sont refusés par les règles du dépôt.
- **Pour toute contribution :**
  1. Créez une branche dédiée : `git checkout -b feature/ma-fonctionnalite develop`
  2. Validez le code localement :
     ```bash
     npm run lint
     npm run format:check
     ```
  3. Committez vos modifications (le hook Husky `pre-commit` bloque tout code non conforme).
  4. Poussez votre branche et ouvrez une Pull Request vers `develop`.
  5. La PR ne peut être fusionnée que si le check CI (`qualite`) est au vert.
