// L'assistant (ADR 0009) : Mistral via l'API compatible /chat/completions,
// réponse en JSON. Il reçoit un prompt système propre à l'univers et seulement
// le catalogue de cet univers (ADR 0010), plus les passages du service Data
// déjà filtrés pour le client connecté (ADR 0008 et 0011).
import {
  defaultProposition,
  UNIVERSES,
  type GlossaryEntry,
  type Product,
  type StoredProposition,
  type Universe,
} from './catalogue.js';
import { config } from './config.js';
import type { Client } from './session.js';

const UNIVERSE_PROMPTS: Record<Universe, string> = {
  flavor: `Tu es l'assistant de commande de Givaudan pour les ARÔMES alimentaires (flavors).
Vocabulaire : note aromatique, profil, base d'application (boisson, base protéinée, laitier), stabilité, sans sucre ajouté, arôme naturel ou nature-identique.
Points à vérifier dans le brief : l'application, le profil de goût recherché, les contraintes (sucre, acidité, naturalité) et le marché visé.
Réglementation : tu ne garantis jamais une conformité. Si une référence est en « Diffusion restreinte », dis-le et recommande l'avis d'un expert.`,
  fragrance: `Tu es l'assistant de commande de Givaudan pour les PARFUMS (fragrances).
Vocabulaire : notes de tête, de cœur et de fond, famille olfactive, application (savon, gel douche, bougie), tenue.
Points à vérifier dans le brief : l'application, l'ambiance olfactive recherchée, le positionnement (premium, naturel) et le marché visé.
Réglementation : tu ne garantis jamais une conformité (allergènes, marchés). Si une référence est en « Diffusion restreinte », dis-le et recommande l'avis d'un expert.`,
};

const COMMON_PROMPT = `Tu t'adresses à une petite entreprise qui n'est pas experte : vouvoie le client, écris en français simple et explique chaque terme technique.
Tu choisis exactement 3 références dans le catalogue fourni, de la plus adaptée à la moins adaptée. Tu n'inventes jamais de référence : chaque "productId" doit être un "id" du catalogue fourni.
Tu peux t'appuyer sur les passages du service Data (fiches, historique du client). Tu ne cites jamais un autre client.
Si le brief relève clairement de l'autre univers (parfums ou arômes), renvoie seulement l'autre valeur dans "universe" et un tableau "propositions" vide.

Réponds uniquement avec un objet JSON de cette forme :
{
  "universe": "flavor" ou "fragrance",
  "propositions": [
    {
      "productId": "PR-000",
      "matchScore": entier de 0 à 100, adéquation avec le brief,
      "summary": "famille · impression en quelques mots",
      "profileHighlight": "le profil en une phrase courte",
      "glossary": [{ "term": "terme technique utilisé", "plain": "son explication en une phrase simple" }],
      "reason": "deux phrases au plus : pourquoi cette référence répond au brief"
    }
  ]
}`;

export type AssistantAnswer = { universe?: Universe; propositions: unknown[] };

// `retry` : une nouvelle tentative a-t-elle une chance d'aboutir ?
export type AssistantResult =
  { ok: true; answer: AssistantAnswer } | { ok: false; retry: boolean };

export async function askAssistant(input: {
  brief: string;
  universe: Universe;
  catalogue: Product[];
  passages: string[];
  client: Client;
}): Promise<AssistantResult> {
  const { aiBaseUrl, aiModel, aiApiKey } = config;
  if (!aiBaseUrl || !aiModel) return { ok: false, retry: false };

  // Les fiches produit de l'autre univers ne sont pas transmises
  const ids = new Set(input.catalogue.map((product) => product.id));
  const passages = input.passages.filter(
    (passage) =>
      !/PRODUIT \|/.test(passage) ||
      (passage.match(/PR-\d+/g) ?? []).every((id) => ids.has(id)),
  );

  const user = [
    `Client : ${input.client.company}`,
    `Brief : """${input.brief}"""`,
    `Catalogue (${input.universe}) :`,
    ...input.catalogue.map((product) => JSON.stringify(product)),
    passages.length > 0
      ? `Passages du service Data :\n${passages.map((p) => `- ${p.slice(0, 700)}`).join('\n')}`
      : 'Passages du service Data : aucun (service indisponible).',
  ].join('\n');

  try {
    const response = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiApiKey}`,
      },
      body: JSON.stringify({
        model: aiModel,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `${UNIVERSE_PROMPTS[input.universe]}\n\n${COMMON_PROMPT}`,
          },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(config.aiTimeoutMs),
    });
    if (!response.ok) {
      console.warn(`Assistant : HTTP ${response.status}`);
      // Clé refusée : inutile d'insister
      return { ok: false, retry: ![401, 403].includes(response.status) };
    }
    const data = await response.json();
    const answer = JSON.parse(data.choices[0].message.content);
    return {
      ok: true,
      answer: {
        universe: UNIVERSES.includes(answer?.universe)
          ? answer.universe
          : undefined,
        propositions: Array.isArray(answer?.propositions)
          ? answer.propositions
          : [],
      },
    };
  } catch (error) {
    const { name, message } = error as Error;
    console.warn(`Assistant : ${name} ${message}`);
    // Délai dépassé ou réseau coupé : on ne fait pas attendre le client deux
    // fois. Un JSON illisible, lui, mérite une seconde chance.
    return { ok: false, retry: name === 'SyntaxError' || name === 'TypeError' };
  }
}

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

// Valide la réponse du LLM : une référence absente du catalogue de l'univers,
// en double, ou une carte incomplète invalide toute la réponse.
export function validatePropositions(
  raw: unknown[],
  catalogue: Product[],
): StoredProposition[] | undefined {
  const expected = Math.min(3, catalogue.length);
  const ids = new Set(catalogue.map((product) => product.id));
  const seen = new Set<string>();
  const propositions: StoredProposition[] = [];

  for (const entry of raw.slice(0, 3)) {
    const item = (entry ?? {}) as Record<string, unknown>;
    const productId = text(item.productId);
    const score = Number(item.matchScore);
    const summary = text(item.summary);
    const reason = text(item.reason);
    if (!ids.has(productId) || seen.has(productId)) return undefined;
    if (!Number.isFinite(score) || !summary || !reason) return undefined;
    seen.add(productId);

    const glossary: GlossaryEntry[] = (
      Array.isArray(item.glossary) ? item.glossary : []
    )
      .map((entry) => ({ term: text(entry?.term), plain: text(entry?.plain) }))
      .filter((entry) => entry.term && entry.plain)
      .slice(0, 3);

    // Profil ou « En clair » absents : on reprend le texte par défaut de la fiche
    const fallback = defaultProposition(
      catalogue.find((product) => product.id === productId)!,
      score,
    );
    propositions.push({
      productId,
      matchScore: Math.max(0, Math.min(100, Math.round(score))),
      summary,
      profileHighlight:
        text(item.profileHighlight) || fallback.profileHighlight,
      glossary: glossary.length > 0 ? glossary : fallback.glossary,
      reason,
    });
  }
  if (propositions.length !== expected || expected === 0) return undefined;
  return propositions.sort((a, b) => b.matchScore - a.matchScore);
}
