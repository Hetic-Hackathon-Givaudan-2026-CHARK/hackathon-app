# 0014. Le modèle local de l'assistant est qwen2.5:1.5b

- Statut : acceptée
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

[0013](0013-assistant-local-ollama.md) garde l'IA en local avec Ollama et `llama3.2:1b`, et réduit le rôle du LLM à la rédaction de « Pourquoi cette référence ? ». Même avec ce rôle réduit, `llama3.2:1b` écrit un français approximatif (« La client demande… », « Réponse au goût et à l'application »), mélange les références (il parle de gingembre pour Mangue Passion) et casse souvent son JSON sur les parfums. 0013 prévoyait de pouvoir changer de modèle par la seule variable `AI_MODEL`.

Mesures du 2026-11-12 sur le poste de démo, mêmes 4 briefs, même prompt, deux passages chacun :

| Modèle         | Taille | Temps par brief | Explications valables                             |
| -------------- | ------ | --------------- | ------------------------------------------------- |
| `llama3.2:1b`  | 1,3 Go | de 7 à 32 s     | 0/3 à 3/3 selon l'essai, contenu souvent faux     |
| `qwen2.5:1.5b` | 1,0 Go | de 13 à 18 s    | 23 sur 24, en bon français, citant le profil réel |

L'équipe Data utilise déjà `qwen2.5:1.5b` pour son propre service.

## Options

1. **Garder `llama3.2:1b` :** aucun téléchargement, mais des explications qu'on ne peut pas montrer en démo.
2. **`qwen2.5:1.5b` (retenue) :** plus léger, plus régulier, meilleur en français et en JSON ; le même modèle que l'équipe Data.
3. **Un modèle de 3 milliards de paramètres :** sans doute meilleur encore, mais plus lent sans GPU et non mesuré aujourd'hui.

## Décision

Nous choisissons l'option 2 : `AI_MODEL=qwen2.5:1.5b`, à installer sur la machine hôte avec `ollama pull qwen2.5:1.5b`. Le reste de 0013 ne change pas (Ollama local, classement par la recherche Data et les mots du brief, LLM limité aux explications, repli de [0012](0012-repli-propositions-figees.md)).

## Conséquences

- Positives : des explications présentables en démo ; un temps de réponse plus régulier ; un seul modèle de LLM pour les deux équipes.
- Négatives, à accepter : un téléchargement d'environ 1 Go sur chaque poste ; l'assistant n'est pas plus rapide (de 13 à 18 s sur un poste sans GPU).
- À revoir si : un poste avec GPU permet un modèle de 3 milliards de paramètres ou plus (option 3, par configuration).
