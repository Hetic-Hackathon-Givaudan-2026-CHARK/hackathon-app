# 0010. Un catalogue commun avec un univers obligatoire, deux parcours distincts dans l'interface

- Statut : acceptée
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

L'énoncé exige de distinguer la plateforme Parfums (fragrances) de la plateforme Arômes alimentaires (flavors). Le spike [#8](https://github.com/Hetic-Hackathon-Givaudan-2026-CHARK/hackathon-app/issues/8) pose la question : un catalogue commun filtré, ou deux parcours séparés ? Son seuil : ne pas dupliquer plus de deux tables.

## Options

1. **Tables communes avec une colonne `universe` (`fragrance` | `flavor`) obligatoire partout :** aucune table dupliquée ; l'API refuse toute requête sans univers.
2. **Deux jeux de tables et deux assistants :** séparation maximale, mais toutes les tables et toutes les routes en double.
3. **Un catalogue commun sans distinction visible :** simple, mais contraire à l'énoncé.

## Décision

Nous choisissons l'option 1 :

- `products` et `projects` portent une colonne `universe` non nulle.
- Les wireframes Figma n'ont pas de sélecteur Arômes / Parfums à l'écran 1 : le client décrit son besoin librement. L'assistant déduit l'univers du brief, l'écran 2 l'affiche, et le client peut le corriger. Un projet reste dans un seul univers ; `BriefRequest.universe` permet de le forcer.
- L'assistant reçoit un prompt système propre à chaque univers (vocabulaire, questions de qualification, contraintes réglementaires) et seulement le catalogue de cet univers.

Le spike #8 est clos par cet ADR.

## Conséquences

- Positives : respect de l'énoncé sans duplication ; un seul code à maintenir.
- Négatives, à accepter : chaque requête SQL doit filtrer sur `universe` ; un oubli mélangerait les parcours. L'univers déduit peut être faux pour un brief ambigu : il doit rester visible et corrigeable.
- À revoir si : Givaudan veut deux produits commerciaux séparés (marques, domaines ou équipes différentes).
