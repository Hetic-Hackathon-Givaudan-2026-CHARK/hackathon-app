# 0011. Des comptes de démo et un cloisonnement par client appliqué côté serveur

- Statut : acceptée
- Date : 2026-11-12
- Décideurs : Bryan (tech)

## Contexte

La plateforme s'adresse à des clients externes de Givaudan, et chaque client ne doit voir que ses propres données (commandes, échantillons, conversations). Le prototype doit le montrer avec deux comptes : Léa (petite marque, Arômes), qui porte la démo, et Marc, un second client dont la liste « Mes projets enregistrés » est différente. Il n'y a pas le temps de brancher un vrai fournisseur d'identité avant 17 h.

## Options

1. **Comptes de démo et session côté serveur (retenue) :** l'écran de connexion propose Léa ou Marc ; l'API crée une session (jeton aléatoire dans un cookie `HttpOnly`, `SameSite=Lax`, stocké dans la table `sessions`) et déduit le client de la session pour chaque requête.
2. **Identifiant du client envoyé par le front (en-tête ou paramètre) :** quelques lignes de code, mais n'importe qui pourrait lire les données d'un autre client en changeant la valeur. Ça contredit le message du pitch.
3. **Vrai fournisseur d'identité (OIDC : Microsoft Entra ID, Auth0…) :** la cible en production, mais trop long à configurer aujourd'hui.

## Décision

Nous choisissons l'option 1, sans nouvelle dépendance (jeton généré avec `node:crypto`) :

- `POST /api/session` ouvre une session pour un compte de démo, `DELETE /api/session` la ferme, `GET /api/me` renvoie le client connecté.
- Toutes les routes métier exigent une session et filtrent par `client_id` en SQL : un projet d'un autre client renvoie 404. Le front n'envoie jamais d'identifiant de client.
- Le LLM ne reçoit que les données du client connecté.

La cible de production, à présenter dans le pitch : connexion par le SSO de Givaudan (OIDC), invitation des clients, journal des accès.

## Conséquences

- Positives : le cloisonnement est réel et démontrable (Léa ne voit pas les commandes de Marc) ; aucune dépendance ajoutée.
- Négatives, à accepter : pas de mot de passe ; ce n'est pas une authentification de production.
- À revoir si : le prototype est ouvert à de vrais utilisateurs.
