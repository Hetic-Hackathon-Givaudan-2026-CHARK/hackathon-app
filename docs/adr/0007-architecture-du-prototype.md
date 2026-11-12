# 0007. L'API Express orchestre le prototype : front, base, service Data et LLM

- Statut : acceptée
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

Le prototype doit être rendu le 2026-11-12 à 17 h. Les wireframes Figma « Maquettes Givaudan G10 » décrivent un parcours en 5 étapes pour les petites entreprises : décrire son besoin, voir 3 propositions expliquées, affiner le profil, suivre son projet, puis recevoir un échantillon ou contacter un expert. La démo suit Léa (petite marque de boissons protéinées). Trois briques existent déjà : le monorepo Node/Express/Vite ([0004](0004-architecture-monorepo.md)), PostgreSQL ([0002](0002-base-de-donnees-postgresql.md)) et le service RAG de l'équipe Data (FastAPI, Python, dépôt `equipe10`). Il reste environ 6 h de développement pour une personne côté tech.

## Options

1. **API Express comme point d'entrée unique (« backend for frontend ») :** le navigateur ne parle qu'à `/api/*`. L'API lit et écrit dans PostgreSQL, appelle le service Data et le LLM. Les clés et l'URL du service Data restent côté serveur.
2. **Le front appelle directement le service Data et le LLM :** moins de code serveur, mais la clé du LLM serait exposée dans le navigateur, l'URL ngrok aussi, et le cloisonnement par client deviendrait impossible à garantir.
3. **Tout réécrire en Python dans le dépôt Data :** une seule langue côté serveur, mais on jette le monorepo, la CI et le dev container déjà en place.

## Décision

Nous choisissons l'option 1.

- **Langages :** TypeScript partout dans `hackathon-app` (API Express 5, front Vite). Le Python reste dans le dépôt Data.
- **Front :** Vite + TypeScript sans framework, comme aujourd'hui. Le prototype compte six vues : connexion, puis les 5 étapes des wireframes, chacune dans un `<section>` affiché ou masqué. Le style reprend la maquette haute fidélité de Product. Un framework ajouterait une migration et une courbe d'apprentissage sans gain sur ce périmètre.
- **Base :** PostgreSQL 17 reste la source de vérité pour les comptes de démo, le catalogue et les **projets** (brief, propositions, référence choisie, réglages, statut). Le service Data n'est pas une base : il enrichit les propositions.
- **Hors périmètre aujourd'hui :** l'envoi d'un brief en PDF (bouton affiché mais désactivé) et le parcours grand compte (réassort).
- **Démo :** l'application tourne dans le dev container et la vidéo est enregistrée en local. Si un lien est demandé, on expose le front Vite par un tunnel ngrok. Pas d'hébergement cloud avant 17 h.

## Conséquences

- Positives : une seule porte d'entrée à sécuriser ; le front peut avancer sur des réponses simulées pendant que l'API se branche ; les secrets ne quittent pas le serveur.
- Négatives, à accepter : l'API Express porte plus de logique (orchestration, filtrage par client) ; pas d'URL publique stable.
- À revoir si : le prototype doit être testé par des utilisateurs externes sans nous (il faudrait alors un hébergement géré et l'authentification de [0011](0011-comptes-de-demo-et-cloisonnement.md) en version réelle).
