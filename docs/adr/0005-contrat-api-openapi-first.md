# 0005. Le contrat d'API est un fichier OpenAPI écrit avant le code

- Statut : acceptée
- Date : 2026-11-10
- Décideurs : l'équipe

## Contexte

L'équipe se répartit entre front, API et IA, et les décisions produit ne sont pas encore prises : les routes vont bouger. Le prototype doit rester crédible pour la démonstration de 2 minutes, même si une partie est simulée. Sans accord écrit sur les échanges, le front attend l'API, ou l'inverse.

## Options

1. **`openapi.yaml` versionné, écrit en premier :** le front peut mocker l'API dès le premier jour, et une PR de contrat se relit sans lire le code. Coût : le fichier peut diverger du code s'il n'est pas relu en PR.
2. **Contrat implicite dans le code Express :** aucun fichier à maintenir, mais le front doit lire le code de l'API pour savoir quoi appeler.
3. **Route `/docs` générée depuis le code :** toujours à jour, mais le contrat n'existe qu'après le code, donc ne débloque personne en amont.

## Décision

Nous choisissons l'option 1 : [`openapi.yaml`](../../openapi.yaml) à la racine. Toute modification d'une route le modifie d'abord, dans la même PR que le code.

## Conséquences

- Positives : front et API avancent en parallèle ; les routes « à construire » servent de backlog.
- Négatives, à accepter : une relecture de plus en PR ; un risque de divergence tant qu'aucun test ne compare fichier et API.
- À revoir si : le contrat diverge du code dans deux PR de suite (on générerait alors le fichier depuis le code).
