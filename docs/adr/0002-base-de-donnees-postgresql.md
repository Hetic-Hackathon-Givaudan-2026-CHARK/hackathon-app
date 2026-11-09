# 0002. Base de données relationnelle PostgreSQL 17

- Statut : acceptée
- Date : 2026-11-05
- Décideurs : Tech-Lead & Équipe

## Contexte

L'application doit persister les questions posées, les réponses générées par l'IA et les métadonnées associées. L'API backend et les éventuels scripts d'analyse de données doivent pouvoir accéder aux données simultanément.

## Options

1. **PostgreSQL 17 (retenue) :** SGBD relationnel robuste, support natif du format JSON, extensions vectorielles possibles (ex: `pgvector`), conteneur officiel disponible.
2. **SQLite :** Très léger sans conteneur, mais supporte mal les accès concurrents simultanés (API + scripts) et moins représentatif d'une architecture de production.
3. **MongoDB :** Documentaire, mais les données prévues possèdent des relations fortes et l'équipe maîtrise SQL.

## Décision

Nous choisissons **PostgreSQL 17** démarré comme service dans `compose.yaml` avec persistance locale dans `./db/data` et scripts d'initialisation dans `./db/init`.

## Conséquences

- Positives : Prêt pour la production, persistance isolée, compatible avec les outils d'inspection SQL (TablePlus, DBeaver via le port exposé `5432`).
- Négatives à accepter : Nécessite un conteneur dédié avec healthcheck avant de lancer l'API.
- À revoir si : L'hébergement final de production impose une base de données cloud managée spécifique.
