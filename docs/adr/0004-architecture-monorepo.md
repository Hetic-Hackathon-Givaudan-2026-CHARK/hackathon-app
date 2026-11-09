# 0004. Architecture Monorepo avec npm Workspaces

- Statut : acceptée
- Date : 2026-11-05
- Décideurs : Tech-Lead & Équipe

## Contexte

Le projet combine un backend d'API (`api`) et une application web (`web`). Pour un hackathon d'équipe de courte durée, synchroniser les modifications entre deux dépôts GitHub distincts crée des frictions inutiles.

## Options

1. **Monorepo avec npm workspaces (retenue) :** Un seul dépôt Git, un seul `npm install`, outillage partagé (ESLint, Prettier, Husky, GitHub Actions).
2. **Polyrepo (deux dépôts distincts) :** Séparation stricte des responsabilités, mais double gestion de branches, de PRs, et désynchronisation fréquente entre l'API et le front.

## Décision

Nous choisissons le **Monorepo géré avec npm workspaces** avec deux sous-projets : `api` (Express + TS) et `web` (Vite + TS).

## Conséquences

- Positives : Un seul clone, scripts unifiés (`npm run dev`, `npm run lint`), PRs atomiques modifiant à la fois l'API et le frontend.
- Négatives à accepter : Nécessite une rigueur sur l'installation des dépendances (`-w api` ou `-w web`).
- À revoir si : L'équipe grandit et requiert des pipelines de déploiement totalement indépendants.
