// Comptes de démo et session côté serveur (ADR 0011) : un jeton aléatoire dans
// un cookie HttpOnly, dont seul le SHA-256 est stocké dans la table sessions.
import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.js';

export type Client = { id: string; name: string; company: string };

const COOKIE = 'sid';
const MAX_AGE_SECONDS = 12 * 60 * 60;
// En production (HTTPS), ajouter l'attribut Secure
const COOKIE_ATTRIBUTES = 'HttpOnly; SameSite=Lax; Path=/';

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

function readToken(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === COOKIE && value.length > 0) return value.join('=');
  }
  return undefined;
}

// Renvoie false si le compte de démo n'existe pas
export async function openSession(
  account: string,
  res: Response,
): Promise<boolean> {
  const { rows } = await db.query('SELECT id FROM clients WHERE account = $1', [
    account,
  ]);
  if (rows.length === 0) return false;

  const token = randomBytes(32).toString('base64url');
  await db.query('DELETE FROM sessions WHERE expires_at < now()');
  await db.query(
    `INSERT INTO sessions (token_hash, client_id, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [hash(token), rows[0].id, MAX_AGE_SECONDS],
  );
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; ${COOKIE_ATTRIBUTES}; Max-Age=${MAX_AGE_SECONDS}`,
  );
  return true;
}

export async function closeSession(req: Request, res: Response): Promise<void> {
  const token = readToken(req);
  if (token) {
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [hash(token)]);
  }
  res.setHeader('Set-Cookie', `${COOKIE}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`);
}

// Toutes les routes métier passent par ici : le client vient de la session,
// jamais d'une valeur envoyée par le front.
export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readToken(req);
  const { rows } = token
    ? await db.query(
        `SELECT c.id, c.contact_name AS name, c.company
         FROM sessions s JOIN clients c ON c.id = s.client_id
         WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [hash(token)],
      )
    : { rows: [] };
  if (rows.length === 0) {
    res.status(401).json({ error: 'Pas de session' });
    return;
  }
  res.locals.client = rows[0] satisfies Client;
  next();
}

export const clientOf = (res: Response): Client => res.locals.client;
