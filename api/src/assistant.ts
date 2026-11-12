// L'assistant (ADR 0013) : un modèle local servi par Ollama, appelé par l'API
// compatible /chat/completions, réponse en JSON.
//
// Un petit modèle (1 à 3 milliards de paramètres) classe mal les références,
// répond lentement et recopie souvent le gabarit qu'on lui donne. Le
// classement vient donc de ranking.ts ; le modèle rédige seulement le bloc
// « Pourquoi cette référence ? » des 3 cartes, à partir du brief, des fiches
// et de l'historique du client connecté (ADR 0008 et 0011). Il reçoit un
// prompt système propre à l'univers et seulement des références de cet univers
// (ADR 0010).
import type { Product, Universe } from './catalogue.js';
import { config } from './config.js';
import { stems } from './ranking.js';
import type { Client } from './session.js';

const UNIVERSE_PROMPTS: Record<Universe, string> = {
  flavor:
    "Tu es l'assistant de commande de Givaudan pour les ARÔMES alimentaires. Tu parles du goût, de l'application (boisson, base protéinée…) et des contraintes (sucre, acidité, naturalité).",
  fragrance:
    "Tu es l'assistant de commande de Givaudan pour les PARFUMS. Tu parles de l'ambiance olfactive, de l'application (savon, gel douche…) et du positionnement (premium, naturel).",
};

const COMMON_PROMPT = `Pour chaque référence fournie, écris une phrase en français simple, au vouvoiement, qui explique au client pourquoi elle répond à son brief. Appuie-toi sur le profil et l'application de la référence. N'invente aucune information. Ne garantis jamais une conformité réglementaire.
Réponds uniquement en JSON, avec les identifiants fournis, dans le même ordre.`;

export type AssistantResult =
  | { ok: true; reasons: Map<string, string> }
  // `retry` : une nouvelle tentative a-t-elle une chance d'aboutir ?
  | { ok: false; retry: boolean };

const productLine = (product: Product) =>
  [
    product.id,
    product.name,
    product.family,
    product.profile,
    product.application,
    product.badges.join(', '),
  ].join(' | ');

const text = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

// Une phrase qui recopie la consigne, reste vide ou ne dit rien ne vaut rien
const PLACEHOLDER =
  /^\.*$|une phrase|en français simple|pourquoi elle répond|deux phrases|terme technique|^\.\.\./i;

export async function askAssistant(input: {
  brief: string;
  universe: Universe;
  products: Product[];
  history: string[];
  client: Client;
  timeoutMs: number;
}): Promise<AssistantResult> {
  const { aiBaseUrl, aiModel, aiApiKey } = config;
  if (!aiBaseUrl || !aiModel) return { ok: false, retry: false };

  // L'exemple porte les vrais identifiants : le modèle n'a qu'à remplir
  const shape = JSON.stringify({
    reasons: input.products.map((product) => ({
      productId: product.id,
      reason: '',
    })),
  });
  const user = [
    `Client : ${input.client.company}`,
    `Brief : "${input.brief}"`,
    'Références :',
    ...input.products.map(productLine),
    input.history.length > 0
      ? `Historique du client :\n${input.history.map((h) => `- ${h}`).join('\n')}`
      : '',
    `Format : ${shape}`,
  ]
    .filter(Boolean)
    .join('\n');

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
        max_tokens: 350,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `${UNIVERSE_PROMPTS[input.universe]}\n${COMMON_PROMPT}`,
          },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(input.timeoutMs),
    });
    if (!response.ok) {
      console.warn(`Assistant : HTTP ${response.status}`);
      // Modèle absent ou clé refusée : inutile d'insister
      return { ok: false, retry: ![401, 403, 404].includes(response.status) };
    }
    const data = await response.json();
    const content = String(data?.choices?.[0]?.message?.content ?? '');
    // AI_DEBUG=1 dans api/.env : affiche la réponse brute pour régler le prompt
    if (config.aiDebug) console.log(`Assistant, réponse brute : ${content}`);
    return { ok: true, reasons: readReasons(content, input.products) };
  } catch (error) {
    const { name, message } = error as Error;
    console.warn(`Assistant : ${name} ${message}`);
    // Délai dépassé ou Ollama injoignable : on ne fait pas attendre le client
    // deux fois. Une réponse HTTP illisible, elle, mérite une seconde chance.
    return { ok: false, retry: name === 'SyntaxError' };
  }
}

// Ne garde que les phrases utiles, rattachées à une référence demandée.
// Un petit modèle coupe ou abîme souvent son JSON : si l'analyse échoue, on
// récupère les paires productId / reason complètes directement dans le texte.
export function readReasons(content: string, products: Product[]) {
  const ids = products.map((product) => product.id);
  let entries: unknown[] = [];
  try {
    const list = (JSON.parse(content) as { reasons?: unknown })?.reasons;
    if (Array.isArray(list)) entries = list;
  } catch {
    const pairs = content.matchAll(
      /"productId"\s*:\s*"(PR-\d+)"\s*,\s*"reason"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
    );
    entries = [...pairs].map(([, productId, reason]) => ({
      productId,
      reason: reason.replace(/\\(.)/g, '$1'),
    }));
  }

  const reasons = new Map<string, string>();
  entries.forEach((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    // Un identifiant inconnu ou absent : on se fie à l'ordre demandé
    const id = ids.includes(text(item.productId))
      ? text(item.productId)
      : ids[index];
    const reason = text(item.reason);
    if (!id || reasons.has(id)) return;
    if (reason.length < 40 || PLACEHOLDER.test(reason)) return;
    // La phrase doit parler de cette référence : son nom ou son profil
    const product = products.find((candidate) => candidate.id === id);
    const sheet = new Set(stems(`${product?.name} ${product?.profile}`));
    if (!stems(reason).some((stem) => sheet.has(stem))) return;
    reasons.set(id, reason.slice(0, 400));
  });
  return reasons;
}
