// Les propositions de l'écran 2 : service Data, classement, puis explications
// du LLM local, avec un repli sur les textes des fiches pour que la démo tourne
// sans Ollama ni réseau (ADR 0012 et 0013).
import { askAssistant } from './assistant.js';
import {
  defaultProposition,
  type Product,
  type StoredProposition,
  type Universe,
} from './catalogue.js';
import { config } from './config.js';
import { searchData } from './data.js';
import { db } from './db.js';
import { rankCatalogue } from './ranking.js';
import type { Client } from './session.js';

// ADR 0010 : on ne lit jamais le catalogue sans préciser l'univers
export async function loadCatalogue(universe: Universe): Promise<Product[]> {
  const { rows } = await db.query(
    `SELECT id, reference, name, universe, family, profile, application, badges
     FROM products WHERE universe = $1 ORDER BY id`,
    [universe],
  );
  return rows;
}

// L'univers se déduit de quelques mots du brief. À égalité : arômes.
const FRAGRANCE_WORDS =
  /parfum|senteur|savon|gel douche|bougie|cosm[ée]ti|shampo|lessive|cr[èe]me|d[ée]odorant|fragrance|odeur|lotion/gi;
const FLAVOR_WORDS =
  /boisson|ar[ôo]me|go[ûu]t|shake|prot[ée]in|yaourt|biscuit|saveur|sucr|aliment|dessert|glace|th[ée]\b|caf[ée]|soda|sirop/gi;

export function guessUniverse(brief: string): Universe {
  const fragrance = brief.match(FRAGRANCE_WORDS)?.length ?? 0;
  const flavor = brief.match(FLAVOR_WORDS)?.length ?? 0;
  return fragrance > flavor ? 'fragrance' : 'flavor';
}

// Commandes et échantillons du client (déjà filtrés par data.ts) qui portent
// sur l'une des références proposées : de quoi personnaliser l'explication
function historyFor(passages: string[], ids: string[]): string[] {
  return passages
    .filter((passage) => /COMMANDE \||ÉCHANTILLON \|/.test(passage))
    .filter((passage) => ids.some((id) => passage.includes(`(${id})`)))
    .map((passage) =>
      passage
        .replace(/^Chapter[^\n]*\n/, '')
        .replace(/\s+/g, ' ')
        .slice(0, 220),
    )
    .slice(0, 2);
}

// 1. Le service Data cherche les passages utiles (déjà filtrés pour le client).
// 2. ranking.ts classe le catalogue de l'univers : ordre de la recherche Data,
//    puis mots du brief. L'univers vient du client (BriefRequest.universe) ou
//    des mots du brief ; le client peut le corriger à l'écran 2 (ADR 0010).
// 3. Le LLM local rédige « Pourquoi cette référence ? » pour les 3 premières
//    (ADR 0013). Une réponse inexploitable est relancée une fois si le temps
//    le permet ; sinon, ou si Ollama est injoignable, chaque carte garde un
//    texte tiré de sa fiche (ADR 0012). AI_TIMEOUT_MS borne l'attente totale.
export async function buildPropositions(
  client: Client,
  brief: string,
  forcedUniverse?: Universe,
): Promise<{ universe: Universe; propositions: StoredProposition[] }> {
  const universe = forcedUniverse ?? guessUniverse(brief);
  const catalogue = await loadCatalogue(universe);
  const passages = await searchData(brief, client.id);
  const ranked = rankCatalogue(brief, catalogue, passages).slice(0, 3);
  const products = ranked.map(({ product }) => product);

  let reasons = new Map<string, string>();
  const deadline = Date.now() + config.aiTimeoutMs;
  for (let attempt = 1; attempt <= 2 && products.length > 0; attempt++) {
    const timeoutMs = deadline - Date.now();
    // Moins de 5 s : une seconde réponse n'arriverait pas à temps
    if (attempt > 1 && timeoutMs < 5000) break;
    const started = Date.now();
    const result = await askAssistant({
      brief,
      universe,
      products,
      history: historyFor(
        passages,
        products.map((product) => product.id),
      ),
      client,
      timeoutMs,
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (!result.ok) {
      if (!result.retry) break;
      continue;
    }
    reasons = result.reasons;
    if (reasons.size > 0) {
      console.log(
        `Assistant : ${reasons.size}/${products.length} explications (${universe}, essai ${attempt}, ${seconds} s)`,
      );
      break;
    }
    console.warn(
      `Réponse de l'assistant rejetée (essai ${attempt}, ${seconds} s)`,
    );
  }
  if (reasons.size === 0) {
    console.warn(`Explications tirées des fiches (${universe})`);
  }

  return {
    universe,
    propositions: ranked.map(({ product, matchScore }) =>
      defaultProposition(product, matchScore, reasons.get(product.id)),
    ),
  };
}
