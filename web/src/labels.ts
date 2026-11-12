// Libellés de l'interface et synthèse de l'écran 3, calculée dans le navigateur
import type { Adjustments, Product, Status, Universe } from './api';

export const UNIVERSE_LABELS: Record<Universe, string> = {
  flavor: 'Arômes alimentaires',
  fragrance: 'Parfums',
};

export const STATUS_LABELS: Record<Status, string> = {
  draft: 'Brouillon',
  brief_validated: 'Brief validé',
  sample_preparing: 'Échantillon en préparation',
  shipped: 'Expédié',
  testing: 'Test en cours',
  expert_requested: 'Expert demandé',
};

// La frise de l'écran 4, dans l'ordre
export const TIMELINE: Status[] = [
  'brief_validated',
  'sample_preparing',
  'shipped',
  'testing',
];

export const EXAMPLES: string[] = [
  'Un arôme vanille-caramel sans sucre ajouté pour ma boisson protéinée',
  'Une senteur premium, propre et légèrement musquée, pour des savons artisanaux',
];

type Level = { value: string; label: string; phrase: string };
type Setting = { key: keyof Adjustments; title: string; levels: Level[] };

// Les 3 réglages de l'écran 3, 3 niveaux chacun (schéma Adjustments)
export const SETTINGS: Setting[] = [
  {
    key: 'temperature',
    title: 'Frais ou chaud',
    levels: [
      { value: 'fresh', label: 'Frais', phrase: 'plus fraîche et vive' },
      { value: 'balanced', label: 'Équilibré', phrase: 'équilibrée' },
      { value: 'warm', label: 'Chaud', phrase: 'plus chaude et enveloppante' },
    ],
  },
  {
    key: 'sweetness',
    title: 'Douceur',
    levels: [
      { value: 'discreet', label: 'Discrète', phrase: 'une douceur discrète' },
      { value: 'moderate', label: 'Modérée', phrase: 'une douceur modérée' },
      {
        value: 'pronounced',
        label: 'Prononcée',
        phrase: 'une douceur prononcée',
      },
    ],
  },
  {
    key: 'naturalness',
    title: 'Naturalité',
    levels: [
      {
        value: 'none',
        label: 'Sans exigence',
        phrase: 'sans exigence particulière sur la naturalité',
      },
      {
        value: 'moderate',
        label: 'Modérée',
        phrase: "une préférence pour les ingrédients d'origine naturelle",
      },
      {
        value: 'high',
        label: 'Élevée',
        phrase: 'une exigence de naturalité élevée',
      },
    ],
  },
];

export const DEFAULT_ADJUSTMENTS: Required<Adjustments> = {
  temperature: 'balanced',
  sweetness: 'moderate',
  naturalness: 'moderate',
};

const level = (key: keyof Adjustments, value: string): Level =>
  SETTINGS.find((setting) => setting.key === key)!.levels.find(
    (candidate) => candidate.value === value,
  )!;

// Synthèse en temps réel : une phrase et trois étiquettes, sans appel réseau
export function synthesis(
  product: Product,
  adjustments: Required<Adjustments>,
): { text: string; tags: string[] } {
  const temperature = level('temperature', adjustments.temperature);
  const sweetness = level('sweetness', adjustments.sweetness);
  const naturalness = level('naturalness', adjustments.naturalness);
  const link = adjustments.naturalness === 'none' ? ',' : ' et';
  return {
    text: `${product.name} (${product.reference}) dans une version ${temperature.phrase}, avec ${sweetness.phrase}${link} ${naturalness.phrase}.`,
    tags: [
      temperature.label,
      `Douceur ${sweetness.label.toLowerCase()}`,
      adjustments.naturalness === 'none'
        ? 'Naturalité libre'
        : `Naturalité ${naturalness.label.toLowerCase()}`,
    ],
  };
}

const DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

export const formatDate = (iso: string): string =>
  // Une date seule (AAAA-MM-JJ) est lue à midi pour éviter un décalage de fuseau
  DATE.format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso));
