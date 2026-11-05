import express from 'express';
import pg from 'pg';

// En dev, la configuration vient de api/.env ; en production, de l'hébergeur
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : on garde l'environnement tel quel
}

const { DATABASE_URL, AI_BASE_URL, AI_MODEL, AI_API_KEY = '' } = process.env;
const PORT = Number(process.env.PORT ?? 3000);
const db = new pg.Pool({ connectionString: DATABASE_URL });

const app = express();
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const { rows } = await db.query('SELECT version()');
  res.json({ status: 'ok', db: rows[0].version });
});

app.get('/api/questions', async (_req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM questions ORDER BY id DESC LIMIT 10',
  );
  res.json(rows);
});

app.post('/api/questions', async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) {
    res.status(400).json({ error: 'Question manquante' });
    return;
  }
  const answer = await ask(question);
  const { rows } = await db.query(
    'INSERT INTO questions (question, answer) VALUES ($1, $2) RETURNING *',
    [question, answer],
  );
  res.status(201).json(rows[0]);
});

// Même appel pour Ollama, Mistral, OpenAI… : seule la configuration change
async function ask(question: string): Promise<string> {
  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: question }],
    }),
  });
  if (!response.ok) {
    throw new Error(`IA : ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

// Sans adresse, Node écoute sur toutes les interfaces : joignable hors du conteneur
app.listen(PORT, () => console.log(`API sur http://localhost:${PORT}`));
