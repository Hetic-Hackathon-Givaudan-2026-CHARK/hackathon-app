// Routes des projets (écrans 1 à 5). Chaque requête SQL filtre par client_id :
// un projet d'un autre client est introuvable, donc 404 (ADR 0011).
import { Router, type Response } from 'express';
import {
  UNIVERSES,
  type Product,
  type StoredProposition,
  type Universe,
} from './catalogue.js';
import { config } from './config.js';
import { db } from './db.js';
import { buildPropositions, loadCatalogue } from './propositions.js';
import { clientOf } from './session.js';

const ADJUSTMENTS = {
  temperature: ['fresh', 'balanced', 'warm'],
  sweetness: ['discreet', 'moderate', 'pronounced'],
  naturalness: ['none', 'moderate', 'high'],
} as const;

type Adjustments = Partial<Record<keyof typeof ADJUSTMENTS, string>>;

type ProjectRow = {
  id: string;
  name: string;
  universe: Universe;
  brief: string;
  propositions: StoredProposition[];
  selected_product_id: string | null;
  adjustments: Adjustments | null;
  status: string;
  estimated_delivery: string | null;
  updated_at: Date;
};

const COLUMNS = `id, name, universe, brief, propositions, selected_product_id,
  adjustments, status, estimated_delivery::text AS estimated_delivery, updated_at`;

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function findProject(
  clientId: string,
  id: string,
): Promise<ProjectRow | undefined> {
  if (!UUID.test(id)) return undefined;
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM projects WHERE id = $1 AND client_id = $2`,
    [id, clientId],
  );
  return rows[0];
}

// Forme du contrat (schéma Project) : les fiches produit sont relues dans le
// catalogue de l'univers du projet, jamais dans l'autre.
async function toProject(row: ProjectRow, catalogue?: Product[]) {
  const products = new Map(
    (catalogue ?? (await loadCatalogue(row.universe))).map((p) => [p.id, p]),
  );
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    updatedAt: row.updated_at.toISOString(),
    brief: row.brief,
    universe: row.universe,
    propositions: row.propositions.flatMap(({ productId, ...rest }) => {
      const product = products.get(productId);
      return product ? [{ product, ...rest }] : [];
    }),
    ...(row.selected_product_id && {
      selectedProductId: row.selected_product_id,
    }),
    ...(row.adjustments && { adjustments: row.adjustments }),
    ...(row.estimated_delivery && {
      estimatedDelivery: row.estimated_delivery,
    }),
  };
}

const badRequest = (res: Response, error: string) =>
  res.status(400).json({ error });
const notFound = (res: Response) =>
  res.status(404).json({ error: 'Projet inconnu pour ce client' });

function parseBrief(
  body: unknown,
): { brief: string; universe?: Universe } | string {
  const { brief, universe } = (body ?? {}) as Record<string, unknown>;
  if (typeof brief !== 'string' || brief.trim().length < 10) {
    return 'Brief manquant (10 caractères au minimum)';
  }
  if (universe !== undefined && !UNIVERSES.includes(universe as Universe)) {
    return 'Univers inconnu (fragrance ou flavor)';
  }
  return { brief: brief.trim(), universe: universe as Universe | undefined };
}

function parseAdjustments(value: unknown): Adjustments | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  for (const [key, level] of Object.entries(value)) {
    const levels: readonly string[] | undefined =
      ADJUSTMENTS[key as keyof typeof ADJUSTMENTS];
    if (!levels || !levels.includes(level)) return undefined;
  }
  return value;
}

// Nom par défaut d'un projet : le début du brief, coupé sur un mot
function nameFromBrief(brief: string): string {
  if (brief.length <= 48) return brief;
  return `${brief.slice(0, 48).replace(/\s+\S*$/, '')}…`;
}

// SIMULATION DE DÉMO : le prototype n'a pas de logistique. Quelques secondes
// après la commande d'un échantillon, le projet passe tout seul de
// « échantillon en préparation » à « expédié », pour que la frise de l'écran 4
// avance pendant la démonstration. Délai : DEMO_SHIPPING_DELAY_MS (0 = jamais).
// En production, ce changement viendrait du système de commande de Givaudan.
function simulateShipping(projectId: string, clientId: string) {
  if (config.demoShippingDelayMs <= 0) return;
  setTimeout(() => {
    db.query(
      `UPDATE projects SET status = 'shipped', updated_at = now()
       WHERE id = $1 AND client_id = $2 AND status = 'sample_preparing'`,
      [projectId, clientId],
    ).catch((error) => console.error('Simulation expédition :', error));
  }, config.demoShippingDelayMs).unref();
}

export const projects = Router();

projects.get('/', async (_req, res) => {
  const { rows } = await db.query(
    `SELECT id, name, status, updated_at AS "updatedAt"
     FROM projects WHERE client_id = $1 ORDER BY updated_at DESC`,
    [clientOf(res).id],
  );
  res.json(rows);
});

projects.post('/', async (req, res) => {
  const parsed = parseBrief(req.body);
  if (typeof parsed === 'string') return badRequest(res, parsed);

  const { universe, propositions } = await buildPropositions(
    clientOf(res),
    parsed.brief,
    parsed.universe,
  );
  if (propositions.length === 0) {
    return res.status(502).json({ error: 'Aucune proposition exploitable' });
  }
  const { rows } = await db.query(
    `INSERT INTO projects (client_id, name, universe, brief, propositions)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING ${COLUMNS}`,
    [
      clientOf(res).id,
      nameFromBrief(parsed.brief),
      universe,
      parsed.brief,
      JSON.stringify(propositions),
    ],
  );
  res.status(201).json(await toProject(rows[0]));
});

projects.get('/:id', async (req, res) => {
  const project = await findProject(clientOf(res).id, req.params.id);
  if (!project) return notFound(res);
  res.json(await toProject(project));
});

projects.patch('/:id', async (req, res) => {
  const clientId = clientOf(res).id;
  const project = await findProject(clientId, req.params.id);
  if (!project) return notFound(res);

  const body = (req.body ?? {}) as Record<string, unknown>;
  const params: unknown[] = [project.id, clientId, project.status];
  const updates: string[] = [];
  const set = (column: string, value: unknown, cast = '') => {
    params.push(value);
    updates.push(`${column} = $${params.length}${cast}`);
  };

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return badRequest(res, 'Nom de projet vide');
    }
    set('name', body.name.trim().slice(0, 120));
  }

  let selected = project.selected_product_id;
  if (body.selectedProductId !== undefined) {
    const id = body.selectedProductId;
    if (!project.propositions.some((p) => p.productId === id)) {
      return badRequest(res, 'Référence absente des propositions');
    }
    if (id !== selected) {
      if (project.status !== 'draft') {
        return badRequest(
          res,
          'La référence est figée une fois le brief validé',
        );
      }
      selected = id as string;
      set('selected_product_id', selected);
    }
  }

  if (body.adjustments !== undefined) {
    const adjustments = parseAdjustments(body.adjustments);
    if (!adjustments) return badRequest(res, 'Réglages invalides');
    if (!['draft', 'brief_validated'].includes(project.status)) {
      return badRequest(
        res,
        "Les réglages sont figés une fois l'étape suivante choisie",
      );
    }
    set(
      'adjustments',
      JSON.stringify({ ...project.adjustments, ...adjustments }),
      '::jsonb',
    );
  }

  // Seule transition permise ici : draft → brief_validated
  if (body.status !== undefined) {
    if (
      body.status !== 'brief_validated' ||
      !['draft', 'brief_validated'].includes(project.status)
    ) {
      return badRequest(res, 'Transition de statut interdite');
    }
    if (!selected) {
      return badRequest(
        res,
        'Choisissez une référence avant de valider le brief',
      );
    }
    if (project.status === 'draft') set('status', 'brief_validated');
  }

  if (updates.length === 0) return res.json(await toProject(project));
  const { rows } = await db.query(
    `UPDATE projects SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $1 AND client_id = $2 AND status = $3 RETURNING ${COLUMNS}`,
    params,
  );
  if (rows.length === 0) {
    return badRequest(res, 'Le projet a changé entre-temps, rechargez-le');
  }
  res.json(await toProject(rows[0]));
});

projects.post('/:id/propositions', async (req, res) => {
  const clientId = clientOf(res).id;
  const project = await findProject(clientId, req.params.id);
  if (!project) return notFound(res);

  const parsed = parseBrief(req.body);
  if (typeof parsed === 'string') return badRequest(res, parsed);
  if (project.status !== 'draft') {
    return badRequest(res, 'Le brief est déjà validé');
  }

  const { universe, propositions } = await buildPropositions(
    clientOf(res),
    parsed.brief,
    parsed.universe,
  );
  if (propositions.length === 0) {
    return res.status(502).json({ error: 'Aucune proposition exploitable' });
  }
  // Nouvelles propositions : le choix et les réglages précédents tombent. Le
  // nom suit le brief tant que le client ne l'a pas personnalisé.
  const name =
    project.name === nameFromBrief(project.brief)
      ? nameFromBrief(parsed.brief)
      : project.name;
  const { rows } = await db.query(
    `UPDATE projects
     SET name = $3, universe = $4, brief = $5, propositions = $6::jsonb,
         selected_product_id = NULL, adjustments = NULL, updated_at = now()
     WHERE id = $1 AND client_id = $2 AND status = 'draft' RETURNING ${COLUMNS}`,
    [
      project.id,
      clientId,
      name,
      universe,
      parsed.brief,
      JSON.stringify(propositions),
    ],
  );
  if (rows.length === 0) return badRequest(res, 'Le brief est déjà validé');
  res.json(await toProject(rows[0]));
});

projects.post('/:id/next-step', async (req, res) => {
  const clientId = clientOf(res).id;
  const choice = (req.body ?? {}).choice;
  if (choice !== 'sample' && choice !== 'expert') {
    return badRequest(res, 'Choix inconnu (sample ou expert)');
  }
  const project = await findProject(clientId, req.params.id);
  if (!project) return notFound(res);
  if (project.status === 'draft') {
    return badRequest(res, 'Brief pas encore validé');
  }

  const target = choice === 'sample' ? 'sample_preparing' : 'expert_requested';
  // Rejouer le même choix ne change rien ; commander l'échantillon après avoir
  // demandé un expert reste possible, pas l'inverse.
  const sampleOrdered = ['sample_preparing', 'shipped', 'testing'];
  const alreadyDone =
    choice === 'sample'
      ? sampleOrdered.includes(project.status)
      : project.status === 'expert_requested';
  if (alreadyDone) return res.json(await toProject(project));
  if (choice === 'expert' && project.status !== 'brief_validated') {
    return badRequest(res, "L'échantillon est déjà commandé");
  }

  const { rows } = await db.query(
    `UPDATE projects
     SET status = $3,
         estimated_delivery = CASE WHEN $3 = 'sample_preparing'
           THEN CURRENT_DATE + 7 ELSE estimated_delivery END,
         updated_at = now()
     WHERE id = $1 AND client_id = $2 AND status = $4 RETURNING ${COLUMNS}`,
    [project.id, clientId, target, project.status],
  );
  if (rows.length === 0) {
    return badRequest(res, 'Le projet a changé entre-temps, rechargez-le');
  }
  if (choice === 'sample') simulateShipping(project.id, clientId);
  res.json(await toProject(rows[0]));
});
