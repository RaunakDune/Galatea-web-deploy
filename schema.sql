-- D1 schema for anonymous "Where on the Moon?" answers.
-- Create with:  npx wrangler d1 execute lunarsim-answers --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS answers (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       TEXT NOT NULL,      -- server time (ISO 8601)
  sid      TEXT NOT NULL,      -- random per-visit session id (not linked to a person)
  mode     TEXT,               -- 'mission' or 'practice-Cx'
  round    INTEGER,
  terrain  TEXT,               -- test scene (t1001..t1003)
  query    TEXT,               -- query image name
  cond     TEXT NOT NULL,      -- Sun condition C0..C6
  choice   INTEGER NOT NULL,   -- option index chosen (0-5), -1 = timeout
  answer   INTEGER NOT NULL,   -- correct option index
  correct  INTEGER NOT NULL,   -- 1/0
  rt_ms    INTEGER,            -- response time
  ai_gal   INTEGER,            -- option chosen by the rover AI (Galatea)
  ai_terr  INTEGER,            -- option chosen by the Earth-trained AI
  version  INTEGER
);
CREATE INDEX IF NOT EXISTS answers_cond ON answers (cond);
