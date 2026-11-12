// Service RAG de l'équipe Data (ADR 0008) : on n'utilise que la recherche.
// Tout échec (URL absente, délai dépassé, réponse illisible) renvoie [] :
// l'assistant répond alors à partir du catalogue PostgreSQL seul.
import { config } from './config.js';

// Sans cet en-tête, ngrok renvoie sa page d'avertissement au lieu du JSON
const HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

const CATALOGUE =
  /PRODUIT \||MATIÈRE PREMIÈRE \||\b(product_PR|raw_material_RM)-/;
const HISTORY = /COMMANDE \||ÉCHANTILLON \||\b(order_ORD|sample_SMP)-/;
const CLIENT_RECORD = /CLIENT \||\bclient_CL-/;
const HEADING_ONLY = /^(chapter|chapitre)\s+\d+\s*[:.][^\n]*$/i;

// Cloisonnement (ADR 0008 et 0011). Le service Data renvoie les données de
// tous les clients et regroupe plusieurs fiches dans un même passage : on
// découpe donc chaque passage en paragraphes et on ne garde que
// - les fiches produit et matière première ;
// - les commandes et échantillons dont le seul client cité est celui de la
//   session.
// Tout le reste (fiches client, autre client, type inconnu) est écarté. Le
// filtrage lit le texte tant que le service ne renvoie pas de métadonnées.
export function filterForClient(text: string, clientId: string): string[] {
  const blocks: string[] = [];
  let heading = '';
  for (const paragraph of text.split(/\n\s*\n/).map((p) => p.trim())) {
    if (!paragraph) continue;
    if (HEADING_ONLY.test(paragraph)) {
      heading = paragraph;
      continue;
    }
    blocks.push(heading ? `${heading}\n${paragraph}` : paragraph);
    heading = '';
  }

  return blocks.filter((block) => {
    const clients = new Set(block.match(/CL-\d+/g) ?? []);
    const onlyThisClient = clients.size === 1 && clients.has(clientId);
    if (clients.size > 0 && !onlyThisClient) return false;
    if (CLIENT_RECORD.test(block)) return false;
    if (HISTORY.test(block)) return onlyThisClient;
    return CATALOGUE.test(block);
  });
}

// Passages utiles au brief, déjà filtrés pour le client de la session
export async function searchData(
  question: string,
  clientId: string,
): Promise<string[]> {
  if (!config.dataApiUrl) return [];
  try {
    const response = await fetch(`${config.dataApiUrl}/search`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ question, top_k: 8 }),
      signal: AbortSignal.timeout(config.dataApiTimeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const sources: unknown = await response.json();
    if (!Array.isArray(sources)) throw new Error('réponse inattendue');

    const passages = sources.flatMap((source) =>
      typeof source?.text === 'string'
        ? filterForClient(source.text, clientId)
        : [],
    );
    // Deux passages qui se recouvrent peuvent contenir la même fiche
    return [...new Set(passages)].slice(0, 10);
  } catch (error) {
    console.warn(`Service Data indisponible : ${(error as Error).message}`);
    return [];
  }
}

// Pour /api/health : le service répond-il ?
export async function dataStatus(): Promise<'ok' | 'indisponible'> {
  if (!config.dataApiUrl) return 'indisponible';
  try {
    const response = await fetch(`${config.dataApiUrl}/health`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(Math.min(config.dataApiTimeoutMs, 3000)),
    });
    await response.json();
    return response.ok ? 'ok' : 'indisponible';
  } catch {
    return 'indisponible';
  }
}
