import { existsSync } from 'node:fs';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { warmUpAssistant } from './assistant.js';
import { config } from './config.js';
import { dataStatus, warmUpData } from './data.js';
import { db } from './db.js';
import { projects } from './projects.js';
import {
  clientOf,
  closeSession,
  openSession,
  requireSession,
} from './session.js';

const app = express();
app.use(express.json());

// --- Routes publiques ---

app.get('/api/health', async (_req, res) => {
  const [{ rows }, data] = await Promise.all([
    db.query('SELECT version()'),
    dataStatus(),
  ]);
  res.json({ status: 'ok', db: rows[0].version, data });
});

app.post('/api/session', async (req, res) => {
  const account = req.body?.account;
  if (typeof account !== 'string' || !(await openSession(account, res))) {
    res.status(400).json({ error: 'Compte inconnu' });
    return;
  }
  res.status(204).end();
});

app.delete('/api/session', async (req, res) => {
  await closeSession(req, res);
  res.status(204).end();
});

// --- Routes métier : session obligatoire (ADR 0011) ---

app.get('/api/me', requireSession, (_req, res) => {
  res.json(clientOf(res));
});

app.use('/api/projects', requireSession, projects);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route inconnue' });
});

// Tranche verticale (ADR 0014) : une fois le front construit (`npm run build`),
// l'API le sert elle-même, sur le même port. En développement, Vite le sert.
if (existsSync(config.webDist)) {
  app.use(express.static(config.webDist));
}

// Dernier middleware : JSON illisible → 400, le reste → 500 sans détail
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  const status = (error as { status?: number }).status === 400 ? 400 : 500;
  if (status === 500) console.error(error);
  res
    .status(status)
    .json({ error: status === 400 ? 'Requête illisible' : 'Erreur interne' });
});

// Sans adresse, Node écoute sur toutes les interfaces : joignable hors du conteneur
app.listen(config.port, () => {
  console.log(`API sur http://localhost:${config.port}`);
  // Chauffe du service Data et d'Ollama, sans retarder le démarrage : le
  // premier brief de la démo ne paie plus leur chargement à froid.
  void warmUpData();
  void warmUpAssistant();
});
