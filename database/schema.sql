CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  subscription_token TEXT NOT NULL UNIQUE,
  is_active INTEGER DEFAULT 1,
  expires_at TEXT,
  v2ray_config TEXT,
  wireguard_config TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_token
ON users(subscription_token);
