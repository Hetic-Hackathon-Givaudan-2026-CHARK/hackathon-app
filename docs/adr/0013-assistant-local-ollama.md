# 0013. L'assistant tourne en local avec Ollama : la recherche Data classe les références, le LLM les explique

- Statut : acceptée
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

L'équipe a choisi de garder l'IA en local : option 1 de [0006](0006-fournisseur-ia-assistant-de-commande.md) (modèle local via Ollama) et option 3 de [0009](0009-fournisseur-llm-mistral.md) (`llama3.2:1b`). Aucune donnée ne quitte le poste, il n'y a ni clé ni coût par requête. Ollama tourne sur la machine hôte et l'API l'appelle par `http://host.docker.internal:11434/v1`, avec la même interface `/chat/completions`.

Mesures du 2026-11-12 sur le poste de démo (Ollama sur l'hôte, `llama3.2:1b`, service Data par ngrok) :

- Avec le rôle prévu par 0009 (le LLM choisit 3 références et rédige toute la carte) : de 12 à 47 s par appel. Le modèle recopie le gabarit (« terme technique utilisé », « deux phrases au plus… »), annonce le mauvais univers pour un brief de savon, renvoie 2 références au lieu de 3, et met « Éclat Agrumes » en tête pour un gel douche boisé.
- `POST /search` du service Data : de 2 à 6 s (16 s au premier appel, à froid), et un bon classement : « Vanille Amande » d'abord pour la boisson protéinée vanille de Léa.
- En lui demandant seulement une phrase d'explication par référence : de 7 à 20 s, des phrases correctes mais simples pour les arômes. Le JSON est encore parfois coupé ou abîmé sur les parfums.

## Options

1. **Le LLM local choisit et rédige tout (rôle de 0009) :** un seul appel, mais lent, classement faux et textes recopiés du gabarit.
2. **La recherche Data et les mots du brief classent, le LLM local explique (retenue) :** classement stable et vérifiable ; le LLM n'a plus qu'une tâche courte, celle qu'il fait le moins mal.
3. **Un modèle local plus grand (`llama3.2:3b`, `qwen2.5:3b`) :** meilleur français et meilleur JSON, mais à télécharger sur chaque poste, plus de mémoire et un temps de réponse plus long sans GPU. Il reste possible par la seule variable `AI_MODEL`.

## Décision

Nous choisissons l'option 2, avec Ollama et `llama3.2:1b` (`AI_BASE_URL=http://host.docker.internal:11434/v1`, `AI_MODEL=llama3.2:1b`, `AI_API_KEY` vide). Cet ADR remplace 0006 et 0009.

- **Classement** (`api/src/ranking.ts`) : ordre des fiches produit dans la recherche du service Data, puis mots du brief retrouvés dans la fiche (nom, famille, profil, application). Sans service Data, les mots du brief suffisent. Le `matchScore` vient de ce classement.
- **Univers** : il vient de `BriefRequest.universe` ou des mots du brief, reste affiché et corrigeable à l'écran 2 ([0010](0010-parcours-parfums-et-aromes.md)). Le LLM ne le choisit plus.
- **LLM** (`api/src/assistant.ts`) : un prompt système par univers, les 3 références classées, le brief et au plus 2 commandes ou échantillons du client connecté portant sur ces références. Il renvoie en JSON une phrase « Pourquoi cette référence ? » par référence. Une phrase est rejetée si elle fait moins de 40 caractères, recopie la consigne ou ne cite ni le nom ni le profil de la référence. Un JSON coupé est lu en partie.
- **Délais** : `AI_TIMEOUT_MS` (30 s par défaut) borne l'attente totale, relance comprise ; la relance n'a lieu que s'il reste au moins 5 s.
- **Repli** ([0012](0012-repli-propositions-figees.md)) : une carte sans phrase valable garde un texte tiré de sa fiche. Résumé, profil et bloc « En clair » viennent toujours de la fiche.

## Conséquences

- Positives : aucune donnée envoyée hors du poste, aucune clé ; le bon produit arrive en tête même quand le LLM se trompe ; la démo continue si Ollama est arrêté.
- Négatives, à accepter : des explications de qualité inégale et parfois absentes ; de 10 à 30 s d'attente à l'écran 1 sur un poste sans GPU ; la qualité dépend de la machine qui fait la démo ; le LLM ne déduit plus l'univers.
- Précisé par : [0014](0014-modele-local-qwen.md) (modèle `qwen2.5:1.5b` à la place de `llama3.2:1b`).
- À revoir si : un poste avec GPU ou un modèle plus grand est disponible (option 3, par configuration), ou si Givaudan valide un fournisseur cloud : le LLM pourrait alors reprendre le choix des références.
