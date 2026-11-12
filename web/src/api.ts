// Types et appels du contrat openapi.yaml. Le navigateur ne parle qu'à /api
// (ADR 0007) et n'envoie jamais d'identifiant de client : la session est dans
// un cookie HttpOnly posé par l'API (ADR 0011).

export type Universe = 'fragrance' | 'flavor';

export type Status =
  | 'draft'
  | 'brief_validated'
  | 'sample_preparing'
  | 'shipped'
  | 'testing'
  | 'expert_requested';

export type Client = { id: string; name: string; company: string };

export type Product = {
  id: string;
  reference: string;
  name: string;
  universe: Universe;
  family?: string;
  profile?: string;
  application?: string;
  badges?: string[];
};

export type Proposition = {
  product: Product;
  matchScore: number;
  summary: string;
  profileHighlight?: string;
  glossary?: { term: string; plain: string }[];
  reason: string;
};

export type Adjustments = {
  temperature?: 'fresh' | 'balanced' | 'warm';
  sweetness?: 'discreet' | 'moderate' | 'pronounced';
  naturalness?: 'none' | 'moderate' | 'high';
};

export type ProjectSummary = {
  id: string;
  name: string;
  status: Status;
  updatedAt: string;
};

export type Project = ProjectSummary & {
  brief: string;
  universe: Universe;
  propositions: Proposition[];
  selectedProductId?: string;
  adjustments?: Adjustments;
  estimatedDelivery?: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error ?? `Erreur ${response.status}`,
    );
  }
  return data as T;
}
