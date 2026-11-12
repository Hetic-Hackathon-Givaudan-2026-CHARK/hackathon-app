import express from 'express';
import pg from 'pg';

// En dev, la configuration vient de api/.env ; en production, de l'hébergeur
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : on garde l'environnement tel quel
}

const { DATABASE_URL } = process.env;
const PORT = Number(process.env.PORT ?? 3000);
const db = new pg.Pool({ connectionString: DATABASE_URL });

const app = express();
app.use(express.json());

// --- Routes publiques ---

app.get('/api/health', async (_req, res) => {
  const { rows } = await db.query('SELECT version()');
  res.json({ status: 'ok', db: rows[0].version });
});

// Sans adresse, Node écoute sur toutes les interfaces : joignable hors du conteneur
app.listen(config.port, () =>
  console.log(`API sur http://localhost:${config.port}`),
);
