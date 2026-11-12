# 0015. Le LLM local explique une référence par appel, en texte simple

- Statut : proposée
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

[0013](0013-assistant-local-ollama.md) demande à `llama3.2:1b` une réponse JSON qui contient une phrase « Pourquoi cette référence ? » pour chacune des 3 références classées. Le 2026-11-12, le journal de l'API montrait `Réponse de l'assistant rejetée (essai 1, 24.9 s)` puis `TimeoutError` : 30 s d'attente pour finir sur les textes des fiches.

Mesures du même jour, Ollama sur l'hôte, modèle déjà chargé, brief « Une senteur premium pour des savons » puis « Un arôme vanille-caramel sans sucre ajouté pour ma boisson protéinée » :

- Prompt de 0013 tel quel, 3 essais : le modèle recopie les badges de la fiche (« Approuvé, 3 marchés ») dans les 3 phrases. Toutes sont rejetées (moins de 40 caractères). De 4 à 13 s par appel.
- Même prompt sans les badges, 3 essais (correctif déjà appliqué dans `api/src/assistant.ts`) : des phrases complètes en 14 à 18 s, mais 1 essai sur 3 ne cite aucune référence et un autre invente des ventes (« une des plus achetées »).
- JSON avec une consigne plus stricte, 5 essais : 3 recopient le brief ou le nom seul, 1 seul donne 3 phrases utilisables.
- Une référence par appel, réponse en texte simple, 6 essais : 6 phrases complètes qui citent le nom ou les notes, de 4,5 à 8 s chacune. Défauts relevés : 3 tutoiements, 1 phrase précédée d'une annonce (« Voici la phrase… »), 1 phrase fausse (vanille-caramel attribué à « Citron Gingembre »).

## Options

1. **Garder le JSON à 3 phrases de 0013, sans les badges :** aucun changement de code de plus, mais 1 réponse sur 3 reste inutilisable et l'attente atteint 30 s quand la relance échoue.
2. **Une référence par appel, en texte simple (proposée) :** la tâche la plus courte possible pour un modèle de 1 milliard de paramètres ; une phrase ratée ne fait perdre qu'une carte sur trois ; plus de JSON à réparer. Trois appels au lieu d'un, soit de 14 à 24 s à la suite sur le poste de démo.
3. **Un modèle local plus grand (`llama3.2:3b`) :** meilleur JSON, déjà possible par `AI_MODEL` (option 3 de 0013), mais à télécharger sur le poste de démo et plus lent sans GPU. Non mesuré.

## Décision

Nous proposons l'option 2. Elle ne change ni le fournisseur, ni le modèle, ni le classement de 0013 : seulement la forme de la demande faite au LLM.

- `api/src/assistant.ts` envoie un appel par référence : prompt système de l'univers, brief, nom, famille, notes et application de la référence, sans les badges.
- Le filtre de 0013 reste (40 caractères, consigne recopiée, nom ou profil cité) et gagne deux règles : retirer les guillemets et l'annonce en tête, rejeter une phrase au tutoiement.
- `AI_TIMEOUT_MS` borne toujours l'attente totale des 3 appels. Il n'y a plus de relance : une carte sans phrase valable garde le texte de sa fiche ([0012](0012-repli-propositions-figees.md)).

Si cet ADR est accepté, 0013 passe à « remplacée par 0015 » pour sa partie LLM ; son classement reste en vigueur et sera repris ici.

## Conséquences

- Positives : des explications sur presque toutes les cartes au lieu d'un repli complet ; un journal `Assistant : N/3 explications` qui dit quelle carte a échoué ; moins de code (plus de lecture de JSON abîmé).
- Négatives, à accepter : trois appels à Ollama par brief ; le filtre n'arrête pas une phrase bien formée mais fausse, comme pour 0013 ; l'historique du client (0008) doit être joint à chaque appel.
- À revoir si : un modèle plus grand ou un poste avec GPU rend le JSON fiable (option 3), ou si la mesure sur le poste de démo dépasse 30 s pour 3 appels.
