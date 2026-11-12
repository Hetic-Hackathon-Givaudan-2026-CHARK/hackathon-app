// Rejoue db/init/*.sql sur la base de développement, sans supprimer db/data/.
// Efface toutes les tables : à ne lancer que sur la base du dev container.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

try {
  process.loadEnvFile();
} catch {
  // Pas de .env : on garde l'environnement tel quel
}

const initDir = resolve(import.meta.dirname, '../../db/init');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
for (const file of readdirSync(initDir).sort()) {
  if (!file.endsWith('.sql')) continue;
  await db.query(readFileSync(resolve(initDir, file), 'utf8'));
  console.log(`Joué : db/init/${file}`);
}
await db.end();
