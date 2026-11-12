// Les propositions de l'écran 2 : service Data, puis assistant, avec un repli
// sur des propositions figées pour que la démo tourne sans réseau (ADR 0012).
import { askAssistant, validatePropositions } from './assistant.js';
import {
  defaultProposition,
  type Product,
  type StoredProposition,
  type Universe,
} from './catalogue.js';
import { searchData } from './data.js';
import { db } from './db.js';
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

// Références et scores figés par univers. Si une référence a disparu du
// catalogue, on complète avec les premières références de l'univers.
const FROZEN: Record<Universe, [string, number][]> = {
  flavor: [
    ['PR-007', 92],
    ['PR-005', 84],
    ['PR-006', 73],
  ],
  fragrance: [
    ['PR-001', 91],
    ['PR-004', 82],
    ['PR-003', 74],
  ],
};

export function frozenPropositions(
  universe: Universe,
  catalogue: Product[],
): StoredProposition[] {
  const wanted = FROZEN[universe].map(([id]) => id);
  const products = [
    ...wanted.flatMap((id) => catalogue.filter((p) => p.id === id)),
    ...catalogue.filter((p) => !wanted.includes(p.id)),
  ].slice(0, 3);
  return products.map((product, i) =>
    defaultProposition(product, FROZEN[universe][i][1]),
  );
}

// Sans LLM, l'univers se déduit de quelques mots du brief. À égalité : arômes.
const FRAGRANCE_WORDS =
  /parfum|senteur|savon|gel douche|bougie|cosm[ée]ti|shampo|lessive|cr[èe]me|d[ée]odorant|fragrance|odeur|lotion/gi;
const FLAVOR_WORDS =
  /boisson|ar[ôo]me|go[ûu]t|shake|prot[ée]in|yaourt|biscuit|saveur|sucr|aliment|dessert|glace|th[ée]\b|caf[ée]|soda|sirop/gi;

export function guessUniverse(brief: string): Universe {
  const fragrance = brief.match(FRAGRANCE_WORDS)?.length ?? 0;
  const flavor = brief.match(FLAVOR_WORDS)?.length ?? 0;
  return fragrance > flavor ? 'fragrance' : 'flavor';
}

// 1. Le service Data cherche les passages utiles (déjà filtrés pour le client).
// 2. L'assistant choisit 3 références dans le catalogue d'UN univers.
// 3. Une réponse invalide (référence hors catalogue, carte incomplète) est
//    relancée une fois ; ensuite, ou si l'assistant est injoignable, on sert
//    les propositions figées.
export async function buildPropositions(
  client: Client,
  brief: string,
  forcedUniverse?: Universe,
): Promise<{ universe: Universe; propositions: StoredProposition[] }> {
  let universe = forcedUniverse ?? guessUniverse(brief);
  let catalogue = await loadCatalogue(universe);
  const passages = await searchData(brief, client.id);

  let switched = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await askAssistant({
      brief,
      universe,
      catalogue,
      passages,
      client,
    });
    if (!result.ok) {
      if (!result.retry) break;
      continue;
    }
    // L'assistant lit mieux le brief que nos mots-clés : s'il annonce l'autre
    // univers, on repart une fois avec le prompt et le catalogue de celui-ci.
    const detected = result.answer.universe;
    if (!forcedUniverse && !switched && detected && detected !== universe) {
      universe = detected;
      catalogue = await loadCatalogue(universe);
      switched = true;
      attempt--;
      continue;
    }
    const propositions = validatePropositions(
      result.answer.propositions,
      catalogue,
    );
    if (propositions) {
      console.log(
        `Propositions de l'assistant (${universe}, essai ${attempt})`,
      );
      return { universe, propositions };
    }
    console.warn(`Réponse de l'assistant rejetée (essai ${attempt})`);
  }
  console.warn(`Propositions figées (${universe})`);
  return { universe, propositions: frozenPropositions(universe, catalogue) };
}
