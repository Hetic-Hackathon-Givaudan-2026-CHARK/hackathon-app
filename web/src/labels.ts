// Libellés de l'interface (repris des wireframes) et synthèse de l'écran 3,
// calculée dans le navigateur
import type { Adjustments, Status, Universe } from './api';

export const UNIVERSE_LABELS: Record<Universe, string> = {
  flavor: 'Arômes alimentaires',
  fragrance: 'Parfums',
};

export const PROFILE_LABELS: Record<Universe, string> = {
  flavor: 'Profil aromatique',
  fragrance: 'Profil olfactif',
};

export const STATUS_LABELS: Record<Status, string> = {
  draft: 'Brouillon',
  brief_validated: 'Brief validé',
  sample_preparing: 'Échantillon en préparation',
  shipped: 'Expédié',
  testing: 'Test en cours',
  expert_requested: 'Expert demandé',
};

// La frise de l'écran 4, dans l'ordre, avec le texte d'une étape à venir
export const TIMELINE: { status: Status; label: string; waiting: string }[] = [
  { status: 'brief_validated', label: 'Brief validé', waiting: 'À venir' },
  {
    status: 'sample_preparing',
    label: 'Échantillon en préparation',
    waiting: 'Après commande',
  },
  { status: 'shipped', label: 'Expédié', waiting: 'À venir' },
  { status: 'testing', label: 'Test en cours', waiting: 'Après réception' },
];

// « Pour vous inspirer » : un libellé court, et le brief complet qu'il insère
export const EXAMPLES: { label: string; brief: string }[] = [
  {
    label: 'Une boisson protéinée vanille',
    brief:
      'Un arôme vanille-caramel sans sucre ajouté pour ma boisson protéinée',
  },
  {
    label: 'Une boisson aux agrumes',
    brief:
      'Une boisson fonctionnelle aux agrumes avec une pointe de gingembre, très rafraîchissante',
  },
  {
    label: 'Un savon tout en douceur',
    brief:
      'Une senteur premium, douce et légèrement musquée, pour des savons artisanaux',
  },
  {
    label: 'Un parfum boisé',
    brief: 'Un parfum boisé élégant, pas trop sec, pour un gel douche',
  },
];

type Level = { value: string; label: string; line: string };
export type Setting = {
  key: keyof Adjustments;
  title: string;
  ends: [string, string];
  levels: [Level, Level, Level];
};

// Les 3 réglages de l'écran 3, 3 niveaux chacun (schéma Adjustments)
export const SETTINGS: Setting[] = [
  {
    key: 'temperature',
    title: 'Frais / Chaud',
    ends: ['Frais', 'Chaud'],
    levels: [
      {
        value: 'fresh',
        label: 'Plutôt frais',
        line: 'Une note plutôt fraîche',
      },
      { value: 'balanced', label: 'Équilibré', line: 'Une note équilibrée' },
      { value: 'warm', label: 'Plutôt chaud', line: 'Une note plutôt chaude' },
    ],
  },
  {
    key: 'sweetness',
    title: 'Douceur',
    ends: ['Discrète', 'Prononcée'],
    levels: [
      { value: 'discreet', label: 'Discrète', line: 'Une douceur discrète' },
      { value: 'moderate', label: 'Modérée', line: 'Une douceur modérée' },
      {
        value: 'pronounced',
        label: 'Prononcée',
        line: 'Une douceur prononcée',
      },
    ],
  },
  {
    key: 'naturalness',
    title: 'Naturalité',
    ends: ['Sans préférence', 'Prioritaire'],
    levels: [
      {
        value: 'none',
        label: 'Sans préférence',
        line: 'Pas de préférence sur la naturalité',
      },
      {
        value: 'moderate',
        label: 'Modérée',
        line: 'Une préférence modérée pour la naturalité',
      },
      {
        value: 'high',
        label: 'Élevée',
        line: 'Une forte préférence pour la naturalité',
      },
    ],
  },
];

export const DEFAULT_ADJUSTMENTS: Required<Adjustments> = {
  temperature: 'balanced',
  sweetness: 'moderate',
  naturalness: 'moderate',
};

export const levelIndex = (setting: Setting, value: string): number =>
  Math.max(
    0,
    setting.levels.findIndex((level) => level.value === value),
  );

// Synthèse en temps réel : une ligne par réglage, sans appel réseau
export const synthesisLines = (adjustments: Required<Adjustments>): string[] =>
  SETTINGS.map(
    (setting) =>
      setting.levels[levelIndex(setting, adjustments[setting.key])].line,
  );

const DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

export const formatDate = (iso: string): string =>
  // Une date seule (AAAA-MM-JJ) est lue à midi pour éviter un décalage de fuseau
  DATE.format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso));
