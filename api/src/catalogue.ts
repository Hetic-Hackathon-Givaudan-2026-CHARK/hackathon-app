// Types du catalogue et des propositions, et le texte par défaut d'une
// proposition quand le LLM n'en a pas rédigé (seed, propositions figées).

export type Universe = 'fragrance' | 'flavor';

export const UNIVERSES: readonly Universe[] = ['fragrance', 'flavor'];

export type Product = {
  id: string;
  reference: string;
  name: string;
  universe: Universe;
  family: string;
  profile: string;
  application: string;
  badges: string[];
};

export type GlossaryEntry = { term: string; plain: string };

// Ce qui est stocké dans projects.propositions : le produit est relu dans le
// catalogue à chaque lecture, pour ne jamais servir une fiche périmée.
export type StoredProposition = {
  productId: string;
  matchScore: number;
  summary: string;
  profileHighlight: string;
  glossary: GlossaryEntry[];
  reason: string;
};

// Bloc « En clair » : une explication sans jargon par famille du catalogue
const FAMILY_GLOSSARY: Record<string, string> = {
  Fruité: 'Des notes de fruits mûrs, juteuses et gourmandes.',
  Frais: "Une sensation vive et désaltérante, comme un zeste d'agrume.",
  Gourmand:
    'Des notes qui rappellent la pâtisserie : vanille, amande, biscuit.',
  Floral: 'Des notes de fleurs, douces et élégantes.',
  Boisé: 'Des notes chaudes et sèches qui évoquent le bois.',
};

const BADGE_GLOSSARY: Record<string, string> = {
  Approuvé: "Référence validée, disponible à l'échantillonnage.",
  'Diffusion restreinte':
    "Référence réservée à certains marchés : un expert confirme l'éligibilité.",
};

export function defaultProposition(
  product: Product,
  matchScore: number,
  reason?: string,
): StoredProposition {
  const notes = product.profile.split(',').map((note) => note.trim());
  const glossary: GlossaryEntry[] = [];
  if (FAMILY_GLOSSARY[product.family]) {
    glossary.push({
      term: product.family.toLowerCase(),
      plain: FAMILY_GLOSSARY[product.family],
    });
  }
  for (const badge of product.badges) {
    if (BADGE_GLOSSARY[badge]) {
      glossary.push({
        term: badge.toLowerCase(),
        plain: BADGE_GLOSSARY[badge],
      });
    }
  }
  return {
    productId: product.id,
    matchScore,
    summary: `${product.family} · ${notes.slice(0, 2).join(', ')}`,
    profileHighlight: `Un profil ${product.family.toLowerCase()} : ${product.profile}.`,
    glossary,
    reason:
      reason ??
      `Référence du catalogue conçue pour l'application « ${product.application} », la plus proche de votre besoin.`,
  };
}
