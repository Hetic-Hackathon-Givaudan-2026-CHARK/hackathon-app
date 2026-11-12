import { resolve } from 'node:path';

// En dev, la configuration vient de api/.env ; en production, de l'hébergeur
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : on garde l'environnement tel quel
}

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3000),
  databaseUrl: env.DATABASE_URL,
  // Front construit, servi par l'API quand il existe (ADR 0014)
  webDist: env.WEB_DIST ?? resolve(import.meta.dirname, '../../web/dist'),
  // Assistant (ADR 0013) : Ollama en local, ou toute API compatible
  // /chat/completions. AI_TIMEOUT_MS borne l'attente totale, relance comprise.
  aiBaseUrl: env.AI_BASE_URL?.replace(/\/+$/, ''),
  aiModel: env.AI_MODEL,
  aiApiKey: env.AI_API_KEY ?? '',
  aiTimeoutMs: Number(env.AI_TIMEOUT_MS ?? 30000),
  aiDebug: env.AI_DEBUG === '1',
  // Service RAG de l'équipe Data (ADR 0008)
  dataApiUrl: env.DATA_API_URL?.replace(/\/+$/, ''),
  dataApiTimeoutMs: Number(env.DATA_API_TIMEOUT_MS ?? 8000),
  // Simulation de démo : délai avant qu'un échantillon commandé passe à
  // « expédié » (voir projects.ts). 0 désactive la simulation.
  demoShippingDelayMs: Number(env.DEMO_SHIPPING_DELAY_MS ?? 6000),
};
