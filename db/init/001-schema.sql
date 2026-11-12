-- Schéma du prototype (ADR 0007, 0010 et 0011).
-- Joué au premier démarrage de PostgreSQL. Pour le rejouer sans supprimer
-- db/data/ : npm run db:reset -w api

CREATE TABLE clients (
  id            TEXT PRIMARY KEY CHECK (id ~ '^CL-[0-9]+$'),
  company       TEXT NOT NULL,
  segment       TEXT,
  country       TEXT,
  industry      TEXT,
  language      TEXT,
  account_level TEXT,
  -- Comptes de démo (ADR 0011) : NULL pour les clients sans accès au prototype
  account       TEXT UNIQUE,
  contact_name  TEXT,
  CHECK ((account IS NULL) = (contact_name IS NULL))
);

CREATE TABLE products (
  id          TEXT PRIMARY KEY CHECK (id ~ '^PR-[0-9]+$'),
  reference   TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  -- ADR 0010 : parfums (fragrance) et arômes (flavor) ne se mélangent jamais
  universe    TEXT NOT NULL CHECK (universe IN ('fragrance', 'flavor')),
  family      TEXT,
  profile     TEXT,
  application TEXT,
  markets     TEXT[] NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL,
  badges      TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (id, universe)
);

CREATE TABLE projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           TEXT NOT NULL REFERENCES clients (id),
  name                TEXT NOT NULL,
  universe            TEXT NOT NULL CHECK (universe IN ('fragrance', 'flavor')),
  brief               TEXT NOT NULL,
  -- [{ productId, matchScore, summary, profileHighlight, glossary, reason }]
  propositions        JSONB NOT NULL DEFAULT '[]',
  selected_product_id TEXT,
  -- { temperature, sweetness, naturalness } : les réglages de l'écran 3
  adjustments         JSONB,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'brief_validated', 'sample_preparing',
    'shipped', 'testing', 'expert_requested'
  )),
  estimated_delivery  DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- La référence choisie est forcément dans l'univers du projet
  FOREIGN KEY (selected_product_id, universe) REFERENCES products (id, universe)
);

-- Toutes les lectures filtrent par client (ADR 0011), du plus récent au plus ancien
CREATE INDEX projects_client_idx ON projects (client_id, updated_at DESC);

CREATE TABLE sessions (
  -- SHA-256 du jeton du cookie `sid` : le jeton en clair n'est jamais stocké
  token_hash TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '12 hours'
);
