// Classement des références d'un univers pour un brief (ADR 0013), sans LLM :
// - d'abord l'ordre de la recherche sémantique du service Data (ADR 0008), qui
//   classe bien les fiches produit ;
// - ensuite les mots du brief retrouvés dans la fiche (nom, famille, profil,
//   application), qui suffisent quand le service Data est coupé.
import type { Product } from './catalogue.js';

// Quelques mots du métier qui n'apparaissent pas tels quels dans les fiches
const SYNONYMS: Record<string, string[]> = {
  agrum: ['citron', 'bergamote', 'mandarine'],
  fraic: ['frais', 'citron', 'fraicheur'],
  rafra: ['frais', 'fraicheur'],
  bois: ['santal', 'cedre', 'boise'],
  flora: ['rose', 'pivoine'],
  fleur: ['rose', 'pivoine', 'floral'],
  musqu: ['musc'],
  douce: ['doux'],
  gourm: ['vanille', 'amande', 'biscuit'],
  fruit: ['fruite', 'mangue', 'fraise', 'framboise'],
  tropi: ['mangue', 'passion'],
  energ: ['energetique'],
  rouge: ['fraise', 'framboise', 'cassis'],
  sport: ['proteine', 'energetique'],
};

const STOPWORDS = new Set([
  'pour',
  'avec',
  'sans',
  'dans',
  'notre',
  'votre',
  'nous',
  'vous',
  'une',
  'des',
  'tres',
  'plus',
  'moins',
  'trop',
  'peu',
  'pas',
  'gamme',
  'nouvelle',
  'nouveau',
  'quelque',
  'chose',
]);

// « Protéinée », « protéiné » et « protéines » donnent la même racine « prote »
export const stems = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word))
    .map((word) => word.slice(0, 5));

// Un mot du brief retrouvé dans le goût ou l'odeur (nom, famille, profil)
// compte double par rapport à l'application : « vanille » départage mieux que
// « boisson », présent dans presque toutes les fiches arômes.
function wordScore(brief: string, product: Product): number {
  const sensory = new Set(
    stems([product.name, product.family, product.profile].join(' ')),
  );
  const usage = new Set(stems(product.application));
  let score = 0;
  for (const stem of new Set(stems(brief))) {
    const related = [stem, ...(SYNONYMS[stem] ?? []).flatMap(stems)];
    if (related.some((candidate) => sensory.has(candidate))) score += 2;
    else if (related.some((candidate) => usage.has(candidate))) score += 1;
  }
  return score;
}

// Ordre d'apparition des fiches produit dans les passages du service Data,
// eux-mêmes triés du plus pertinent au moins pertinent
function dataOrder(passages: string[]): string[] {
  const order: string[] = [];
  for (const passage of passages) {
    const match = passage.match(/PRODUIT \| ID interne : (PR-\d+)/);
    if (match && !order.includes(match[1])) order.push(match[1]);
  }
  return order;
}

export type Ranked = { product: Product; matchScore: number };

export function rankCatalogue(
  brief: string,
  catalogue: Product[],
  passages: string[],
): Ranked[] {
  const order = dataOrder(passages);
  const RANK_BONUS = [90, 82, 76, 70];
  return catalogue
    .map((product) => {
      const rank = order.indexOf(product.id);
      const base = rank === -1 ? 62 : (RANK_BONUS[rank] ?? 66);
      return {
        product,
        matchScore: Math.min(98, base + 3 * wordScore(brief, product)),
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
