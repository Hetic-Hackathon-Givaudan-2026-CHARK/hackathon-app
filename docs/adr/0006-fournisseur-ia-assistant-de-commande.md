# 0006. Fournisseur d'IA de l'assistant de commande : API cloud ou modèle local

- Statut : acceptée
- Date : 2026-11-10
- Décideurs : l'équipe

## Contexte

Le défi demande un assistant qui comprend un besoin exprimé librement (« une senteur premium pour une gamme de savons ») et guide vers la bonne référence. Contraintes de l'énoncé : confidentialité des données et usage pertinent de l'IA. Les clients de Givaudan partagent des briefs propriétaires. L'ADR 0003 (Ollama + Llama 3.2 1B) vient du cours ; il n'a pas été évalué contre ce besoin, et un modèle 1B comprend mal des briefs longs et nuancés.

## Options

1. **Modèle local via Ollama :** aucune donnée ne sort de la machine, coût nul. Qualité de dialogue limitée avec un petit modèle, dépend de la machine de chacun.
2. **API cloud d'un modèle frontière :** bien meilleure compréhension des briefs. Coût par requête, clé à protéger, données envoyées à un tiers (à cadrer par RGPD et contrat).
3. **Réponses scriptées pour la démo :** fiable et gratuit, mais ne montre pas la compréhension de l'intention, critère central du défi.

## Décision

Nous choisissons l'option 2 pour le prototype : une API cloud d'un modèle frontière, avec uniquement des données fictives. L'appel reste compatible `/chat/completions` (`AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`), donc un retour vers Ollama ne touche que la configuration. Le spike « un petit modèle local comprend-il un brief ? » ([#7](https://github.com/Hetic-Hackathon-Givaudan-2026-CHARK/hackathon-app/issues/7)) peut remettre ce choix en cause : un nouvel ADR remplacerait alors celui-ci.

## Conséquences

- Positives : choix fondé sur un essai ; changement de fournisseur sans toucher au code.
- Négatives, à accepter : budget d'appels à prévoir ; aucune donnée réelle client dans le prototype.
- À revoir si : le spike montre qu'un modèle local suffit, ou si Givaudan exige un hébergement en Europe. Cet ADR remplace [0003](0003-fournisseur-ia-ollama.md).
