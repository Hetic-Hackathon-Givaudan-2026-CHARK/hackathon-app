# 0012. Quand le LLM échoue, l'API sert quand même 3 références, avec le texte de leur fiche

- Statut : proposée
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

[0009](0009-fournisseur-llm-mistral.md) prévoit qu'une réponse invalide du LLM est relancée une fois, puis « remplacée par un message d'excuse sans suggestion ». Depuis, le contrat d'API v0.2 a remplacé la conversation (`reply`, `suggestions`) par un parcours en 5 écrans : l'écran 2 affiche 3 propositions et tout le reste du parcours (affinage, suivi, échantillon) part d'une référence choisie. Sans proposition, la démo de Léa s'arrête à l'écran 2. La démo du 2026-11-12 dépend du réseau de la salle et du quota de l'offre d'essai Mistral.

## Options

1. **Message d'excuse sans suggestion (0009 tel quel) :** honnête, mais le parcours est bloqué dès qu'un appel échoue.
2. **Propositions figées (retenue) :** après l'échec, l'API renvoie 3 références du catalogue de l'univers du brief, avec un texte construit à partir de la fiche produit. Le parcours continue.
3. **Relancer le LLM jusqu'à obtenir une réponse :** plus de chances d'avoir un texte rédigé, mais une attente sans limite sur un modèle local lent.

## Décision

Nous choisissons l'option 2. Elle amende 0009 sur un seul point (le comportement après échec). Depuis [0013](0013-assistant-local-ollama.md), le classement ne dépend plus du LLM : le repli porte seulement sur les textes.

- Les 3 références viennent toujours du classement de 0013 (recherche Data, puis mots du brief), dans le catalogue de l'univers du projet ([0010](0010-parcours-parfums-et-aromes.md)).
- Une carte sans explication valable du LLM, ou toutes les cartes si le LLM est injoignable (délai `AI_TIMEOUT_MS` dépassé, modèle absent, pas de configuration), gardent un texte tiré de leur fiche.
- Le journal de l'API indique la source (`Assistant : N/3 explications` ou `Explications tirées des fiches`).

## Conséquences

- Positives : la démo tourne sans Ollama ni réseau ; les références restent pertinentes même en repli ; le parcours n'a qu'un seul chemin côté front.
- Négatives, à accepter : en repli, le bloc « Pourquoi cette référence ? » est générique et l'interface ne le signale pas ; le code 502 du contrat ne sert plus que si le catalogue de l'univers est vide.
- À revoir si : le prototype est testé par de vrais clients. Il faudrait alors signaler à l'écran qu'une explication est générique.
