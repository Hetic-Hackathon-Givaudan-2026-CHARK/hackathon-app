# 0012. Quand le LLM échoue, l'API sert des propositions figées du catalogue

- Statut : proposée
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

[0009](0009-fournisseur-llm-mistral.md) prévoit qu'une réponse invalide du LLM est relancée une fois, puis « remplacée par un message d'excuse sans suggestion ». Depuis, le contrat d'API v0.2 a remplacé la conversation (`reply`, `suggestions`) par un parcours en 5 écrans : l'écran 2 affiche 3 propositions et tout le reste du parcours (affinage, suivi, échantillon) part d'une référence choisie. Sans proposition, la démo de Léa s'arrête à l'écran 2. La démo du 2026-11-12 dépend du réseau de la salle et du quota de l'offre d'essai Mistral.

## Options

1. **Message d'excuse sans suggestion (0009 tel quel) :** honnête, mais le parcours est bloqué dès qu'un appel échoue.
2. **Propositions figées (retenue) :** après l'échec, l'API renvoie 3 références du catalogue de l'univers du brief, avec un texte construit à partir de la fiche produit. Le parcours continue.
3. **Repli sur un modèle local (Ollama) :** déjà possible par configuration, mais `llama3.2:1b` dépasse 45 s sur un poste de l'équipe et sa sortie JSON n'est pas fiable.

## Décision

Nous choisissons l'option 2. Elle amende 0009 sur un seul point (le comportement après échec) ; le fournisseur, le modèle et la sortie JSON ne changent pas.

- Le format validé est celui du contrat v0.2 : `universe` et 3 `propositions` (`productId`, `matchScore`, `summary`, `profileHighlight`, `glossary`, `reason`), à la place de `reply` et `suggestions`.
- Une réponse est rejetée en entier si une référence est absente du catalogue de l'univers, en double, ou si une carte est incomplète. Elle est relancée une fois.
- Après le second échec, ou tout de suite si le LLM est injoignable (délai `AI_TIMEOUT_MS` dépassé, clé refusée, pas de configuration), l'API sert les propositions figées de `api/src/propositions.ts`. L'univers vient alors de `BriefRequest.universe` ou de mots-clés du brief.
- Les propositions figées respectent [0010](0010-parcours-parfums-et-aromes.md) : elles ne sortent jamais du catalogue de l'univers.
- Le journal de l'API indique la source (`Propositions de l'assistant` ou `Propositions figées`).

## Conséquences

- Positives : la démo tourne sans réseau ; le parcours n'a qu'un seul chemin côté front.
- Négatives, à accepter : en repli, les 3 références ne dépendent pas du brief et l'interface ne le signale pas ; le code 502 du contrat ne sert plus que si le catalogue de l'univers est vide.
- À revoir si : le prototype est testé par de vrais clients. Il faudrait alors afficher que les propositions sont génériques, ou revenir au message d'excuse.
