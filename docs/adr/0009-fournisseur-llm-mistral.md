# 0009. Le LLM de l'assistant est Mistral Small, avec une réponse en JSON

- Statut : remplacée par [0013](0013-assistant-local-ollama.md)
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

[0006](0006-fournisseur-ia-assistant-de-commande.md) retient une API cloud de modèle frontière, compatible `/chat/completions`, sans choisir le fournisseur. Le spike [#7](https://github.com/Hetic-Hackathon-Givaudan-2026-CHARK/hackathon-app/issues/7) (modèle local contre cloud) n'a pas été mené et il n'y a plus le temps : le rendu est à 17 h. L'interface a besoin d'une réponse structurée (texte + identifiants de produits suggérés), pas d'un texte libre. L'énoncé demande la confidentialité des données ; Givaudan est une entreprise européenne.

## Options

1. **Mistral (`mistral-small-latest`) :** entreprise et hébergement européens, API compatible `/chat/completions`, mode de sortie JSON, offre d'essai pour les tests. Déjà proposé dans `api/.env.example`.
2. **OpenAI ou Anthropic :** qualité équivalente ou supérieure, mais hébergement hors UE par défaut et moyen de paiement à fournir.
3. **Ollama local (`llama3.2:1b`) :** gratuit et local, mais compréhension insuffisante des briefs et sortie JSON peu fiable sur un modèle de cette taille.

## Décision

Nous choisissons Mistral Small : `AI_BASE_URL=https://api.mistral.ai/v1`, `AI_MODEL=mistral-small-latest`, clé dans `api/.env`. L'API demande `response_format: { "type": "json_object" }` et valide la réponse (`reply`, `suggestions` contenant uniquement des identifiants présents dans le catalogue de l'univers demandé). Une réponse invalide est relancée une fois, puis remplacée par un message d'excuse sans suggestion. Seules des données fictives sont envoyées. Le spike #7 est clos par cet ADR.

## Conséquences

- Positives : bonne compréhension des briefs ; argument RGPD crédible pour le pitch ; aucun changement de code par rapport à l'appel existant.
- Négatives, à accepter : dépendance réseau pendant la démo ; quota de l'offre d'essai ; une clé à ne jamais committer.
- À revoir si : Givaudan impose un hébergement interne (Mistral propose aussi des modèles déployables chez le client), ou si le quota bloque la démo (repli sur Ollama par la seule configuration).
