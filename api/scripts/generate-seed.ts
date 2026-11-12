// Génère db/init/002-seed.sql à partir des CSV de l'équipe Data (ADR 0008) :
// mêmes identifiants CL-…, PR-… des deux côtés.
//
//   git clone https://github.com/Hetic-Hackathon-Givaudan-2026-CHARK/equipe10 .scratch/equipe10
//   npm run db:generate-seed -w api [-- chemin/vers/data/raw]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  defaultProposition,
  type Product,
  type Universe,
} from '../src/catalogue.js';

const root = resolve(import.meta.dirname, '../..');
const csvDir = resolve(root, process.argv[2] ?? '.scratch/equipe10/data/raw');

// Lecteur CSV minimal : virgules, guillemets doubles, pas de saut de ligne
// dans un champ (suffisant pour les fichiers de l'équipe Data)
function readCsv(name: string): Record<string, string>[] {
  const lines = readFileSync(resolve(csvDir, name), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  const rows = lines.map((line) => {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (quoted && char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        cells.push(cell);
        cell = '';
      } else {
        cell += char;
      }
    }
    cells.push(cell);
    return cells;
  });
  const [header, ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ''])),
  );
}

const text = (value: string) => `'${value.replaceAll("'", "''")}'`;
const array = (values: string[]) => `ARRAY[${values.map(text).join(', ')}]`;
const json = (value: unknown) => `${text(JSON.stringify(value))}::jsonb`;

// --- Clients : les comptes de démo sont ajoutés ici (ADR 0011) ---
const DEMO_ACCOUNTS: Record<string, { account: string; name: string }> = {
  'CL-002': { account: 'lea', name: 'Léa' },
  'CL-001': { account: 'marc', name: 'Marc' },
};

const clients = readCsv('clients.csv').map((row) => {
  const demo = DEMO_ACCOUNTS[row.client_id];
  return `  (${[
    text(row.client_id),
    text(row.company_name),
    text(row.segment),
    text(row.country),
    text(row.industry),
    text(row.language),
    text(row.account_level),
    demo ? text(demo.account) : 'NULL',
    demo ? text(demo.name) : 'NULL',
  ].join(', ')})`;
});

// --- Produits : `domain` devient `universe`, les badges viennent du statut
// et des marchés (les CSV n'ont pas de certifications) ---
const STATUS_BADGES: Record<string, string> = {
  approved: 'Approuvé',
  restricted: 'Diffusion restreinte',
};

const catalogue = readCsv('products.csv').map((row) => {
  const universe = row.domain.toLowerCase() as Universe;
  if (universe !== 'fragrance' && universe !== 'flavor') {
    throw new Error(`Univers inconnu pour ${row.product_id} : ${row.domain}`);
  }
  const markets = row.markets.split(',').map((market) => market.trim());
  const badges = [
    STATUS_BADGES[row.status] ?? row.status,
    `${markets.length} marchés`,
  ];
  const product: Product = {
    id: row.product_id,
    reference: row.reference,
    name: row.name,
    universe,
    family: row.family,
    profile: row.profile,
    application: row.application,
    badges,
  };
  return { product, markets, status: row.status };
});

const products = catalogue.map(
  ({ product, markets, status }) =>
    `  (${[
      text(product.id),
      text(product.reference),
      text(product.name),
      text(product.universe),
      text(product.family),
      text(product.profile),
      text(product.application),
      array(markets),
      text(status),
      array(product.badges),
    ].join(', ')})`,
);

// --- Projets de démo : des noms différents par compte, dont des brouillons ---
type DemoProject = {
  id: string;
  clientId: string;
  name: string;
  universe: Universe;
  brief: string;
  // [référence, % de match, « Pourquoi cette référence ? »]
  propositions: [string, number, string][];
  selected?: string;
  adjustments?: Record<string, string>;
  status: string;
  deliveryInDays?: number;
  updatedDaysAgo: number;
};

const DEMO_PROJECTS: DemoProject[] = [
  // Léa, NutriPeak Foods (arômes)
  {
    id: '0b6f3a52-8c1d-4e7a-9f20-000000000201',
    clientId: 'CL-002',
    name: 'Shake mangue passion, gamme été',
    universe: 'flavor',
    brief:
      "Un arôme mangue passion peu acide, stable dans une base protéinée, pour notre shake d'été.",
    propositions: [
      [
        'PR-005',
        97,
        'Déjà validée dans vos boissons protéinées : fruitée, peu acide et stable.',
      ],
      [
        'PR-008',
        78,
        'Une alternative fruitée plus vive si vous voulez élargir la gamme.',
      ],
      [
        'PR-006',
        66,
        'Une option fraîche pour une version désaltérante du shake.',
      ],
    ],
    selected: 'PR-005',
    adjustments: {
      temperature: 'fresh',
      sweetness: 'moderate',
      naturalness: 'high',
    },
    status: 'testing',
    deliveryInDays: -6,
    updatedDaysAgo: 2,
  },
  {
    id: '0b6f3a52-8c1d-4e7a-9f20-000000000202',
    clientId: 'CL-002',
    name: 'Boisson énergie fruits rouges',
    universe: 'flavor',
    brief:
      'Une boisson énergétique aux fruits rouges, goût franc, sans arrière-goût sucré.',
    propositions: [
      [
        'PR-008',
        94,
        'Pensée pour les boissons énergétiques : fraise, framboise et cassis bien marqués.',
      ],
      [
        'PR-005',
        72,
        'Un fruité plus rond et tropical, si le cassis paraît trop vif.',
      ],
      ['PR-006', 64, 'Pour une variante plus fraîche et moins sucrée.'],
    ],
    selected: 'PR-008',
    adjustments: {
      temperature: 'balanced',
      sweetness: 'discreet',
      naturalness: 'moderate',
    },
    status: 'sample_preparing',
    deliveryInDays: 9,
    updatedDaysAgo: 5,
  },
  {
    id: '0b6f3a52-8c1d-4e7a-9f20-000000000203',
    clientId: 'CL-002',
    name: 'Eau vitaminée citron gingembre (brouillon)',
    universe: 'flavor',
    brief:
      'Une eau vitaminée au citron avec une pointe de gingembre, très rafraîchissante.',
    propositions: [
      [
        'PR-006',
        95,
        'Citron et gingembre avec une fraîcheur qui dure : exactement le profil décrit.',
      ],
      ['PR-008', 61, 'Une piste fruitée si vous déclinez la gamme.'],
      ['PR-005', 58, 'Une piste tropicale, plus ronde et moins vive.'],
    ],
    status: 'draft',
    updatedDaysAgo: 9,
  },
  // Marc, Maison Éclat (parfums)
  {
    id: '0b6f3a52-8c1d-4e7a-9f20-000000000101',
    clientId: 'CL-001',
    name: 'Savon velours floral, réassort printemps',
    universe: 'fragrance',
    brief:
      'Une senteur florale premium, propre et légèrement musquée, pour notre gamme de savons artisanaux.',
    propositions: [
      [
        'PR-001',
        97,
        'Le profil de vos savons actuels : rose, pivoine et un musc doux.',
      ],
      [
        'PR-004',
        74,
        'Une version plus chaude et gourmande pour une édition limitée.',
      ],
      ['PR-003', 63, 'Une piste plus fraîche pour un savon du matin.'],
    ],
    selected: 'PR-001',
    adjustments: {
      temperature: 'balanced',
      sweetness: 'moderate',
      naturalness: 'high',
    },
    status: 'shipped',
    deliveryInDays: 3,
    updatedDaysAgo: 1,
  },
  {
    id: '0b6f3a52-8c1d-4e7a-9f20-000000000102',
    clientId: 'CL-001',
    name: 'Coffret savons agrumes de Noël',
    universe: 'fragrance',
    brief:
      'Un parfum agrumes lumineux et festif pour un coffret de savons de fin d’année.',
    propositions: [
      [
        'PR-003',
        93,
        'Bergamote, citron et mandarine : un départ très lumineux, adapté au savon.',
      ],
      [
        'PR-004',
        71,
        "Une note d'amande et de vanille pour un coffret cocooning.",
      ],
      ['PR-001', 65, 'Un floral doux, dans la continuité de votre gamme.'],
    ],
    selected: 'PR-003',
    adjustments: {
      temperature: 'fresh',
      sweetness: 'discreet',
      naturalness: 'moderate',
    },
    status: 'brief_validated',
    updatedDaysAgo: 4,
  },
  {
    id: '0b6f3a52-8c1d-4e7a-9f20-000000000103',
    clientId: 'CL-001',
    name: 'Gel douche boisé (brouillon)',
    universe: 'fragrance',
    brief:
      'Un gel douche au parfum boisé élégant, pas trop sec, pour une clientèle mixte.',
    propositions: [
      [
        'PR-002',
        92,
        'Santal, cèdre et ambre doux : un boisé élégant conçu pour le gel douche.',
      ],
      ['PR-003', 68, 'Pour alléger le boisé avec un départ agrumes.'],
      ['PR-004', 60, 'Une piste plus ronde et réconfortante.'],
    ],
    status: 'draft',
    updatedDaysAgo: 12,
  },
];

const byId = new Map(catalogue.map(({ product }) => [product.id, product]));

const projects = DEMO_PROJECTS.map((project) => {
  const propositions = project.propositions.map(([id, score, reason]) => {
    const product = byId.get(id);
    if (!product || product.universe !== project.universe) {
      throw new Error(`${project.name} : ${id} absent de l'univers`);
    }
    return defaultProposition(product, score, reason);
  });
  if (
    project.selected &&
    !project.propositions.some(([id]) => id === project.selected)
  ) {
    throw new Error(`${project.name} : référence choisie hors propositions`);
  }
  const updatedAt = `now() - interval '${project.updatedDaysAgo} days'`;
  return `  (${[
    text(project.id),
    text(project.clientId),
    text(project.name),
    text(project.universe),
    text(project.brief),
    json(propositions),
    project.selected ? text(project.selected) : 'NULL',
    project.adjustments ? json(project.adjustments) : 'NULL',
    text(project.status),
    project.deliveryInDays === undefined
      ? 'NULL'
      : `CURRENT_DATE + ${project.deliveryInDays}`,
    `${updatedAt} - interval '1 day'`,
    updatedAt,
  ].join(', ')})`;
});

const sql = `-- Fichier généré par api/scripts/generate-seed.ts : ne pas modifier à la main.
-- Source : data/raw/*.csv du dépôt equipe10 (ADR 0008), données fictives.

INSERT INTO clients
  (id, company, segment, country, industry, language, account_level, account, contact_name)
VALUES
${clients.join(',\n')};

INSERT INTO products
  (id, reference, name, universe, family, profile, application, markets, status, badges)
VALUES
${products.join(',\n')};

-- Projets de démo de Léa (CL-002) et de Marc (CL-001)
INSERT INTO projects
  (id, client_id, name, universe, brief, propositions, selected_product_id, adjustments, status, estimated_delivery, created_at, updated_at)
VALUES
${projects.join(',\n')};
`;

const target = resolve(root, 'db/init/002-seed.sql');
writeFileSync(target, sql);
console.log(
  `${target} : ${clients.length} clients, ${products.length} produits, ${projects.length} projets`,
);
