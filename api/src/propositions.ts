// Les propositions de l'écran 2. Pour l'instant elles sont figées : trois
// références du catalogue de l'univers, sans appel au LLM.
import {
  defaultProposition,
  type Product,
  type StoredProposition,
  type Universe,
} from './catalogue.js';
import { db } from './db.js';

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

export async function buildPropositions(
  brief: string,
  forcedUniverse?: Universe,
): Promise<{ universe: Universe; propositions: StoredProposition[] }> {
  const universe = forcedUniverse ?? guessUniverse(brief);
  const catalogue = await loadCatalogue(universe);
  return { universe, propositions: frozenPropositions(universe, catalogue) };
}
