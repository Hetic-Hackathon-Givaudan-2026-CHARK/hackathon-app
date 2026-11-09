# 0003. Fournisseur d'IA en local avec Ollama (Llama 3.2 1B)

- Statut : acceptée
- Date : 2026-11-05
- Décideurs : Tech-Lead & Équipe

## Contexte

Le projet requiert une fonctionnalité de réponse intelligente à des questions. Les contraintes du hackathon imposent :

- Un budget de **0 €** (aucun coût récurrent par requête).
- Une sécurité maximale (aucune fuite de clés API secrètes sur GitHub).
- La capacité de développer et tester hors-ligne sans dépendance à des quotas ou pannes d'API tierces.

## Options

1. **Ollama en local sur l'hôte (retenue) :** Modèle `llama3.2:1b` (ou `mistral`), gratuit, accessible depuis le conteneur via `host.docker.internal:11434`.
2. **API Cloud commerciale (OpenAI GPT-4o, Mistral API, Claude) :** Réponses de très haute qualité, mais nécessite un moyen de paiement, une gestion sécurisée de clés d'API (risques de fuite de secrets), et introduit une dépendance réseau.

## Décision

Nous choisissons **Ollama hébergé sur la machine hôte** avec une route d'API générique utilisant l'interface standard compatible OpenAI (`/v1/chat/completions`). Une simple variable d'environnement (`AI_BASE_URL` et `AI_API_KEY`) permettra de basculer vers un fournisseur cloud en production si nécessaire.

## Conséquences

- Positives : Coût financier nul, zéro quota, confidentialité absolue des données, fonctionnement autonome.
- Négatives à accepter : La qualité de génération d'un modèle léger 1B est inférieure à celle d'un modèle frontière (frontier model) ; le temps de réponse dépend du GPU/CPU local.
- À revoir si : La logique métier nécessite des capacités de raisonnement complexes que le modèle 1B ne peut satisfaire.
