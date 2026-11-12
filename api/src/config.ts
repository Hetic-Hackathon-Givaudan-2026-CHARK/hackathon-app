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
  // Simulation de démo : délai avant qu'un échantillon commandé passe à
  // « expédié » (voir projects.ts). 0 désactive la simulation.
  demoShippingDelayMs: Number(env.DEMO_SHIPPING_DELAY_MS ?? 6000),
};
