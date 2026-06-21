PRAGMA foreign_keys = ON;

CREATE TABLE artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'artist' CHECK (role IN ('artist', 'admin')),
  bank_account TEXT NOT NULL,
  about TEXT,
  telegram TEXT,
  instagram TEXT,
  banner_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE registration_codes (
  code TEXT PRIMARY KEY CHECK (length(code) = 6),
  created_by_artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
  used_by_artist_id INTEGER UNIQUE REFERENCES artists(id) ON DELETE SET NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  description TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'reserved', 'sold')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (artist_id, slug)
);

CREATE INDEX idx_items_artist_id ON items(artist_id);
CREATE INDEX idx_items_availability ON items(availability);

CREATE TABLE item_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_item_photos_item_id ON item_photos(item_id);

CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  customer_telegram TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  reserved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  cancelled_at TEXT
);

CREATE INDEX idx_reservations_item_id ON reservations(item_id);
CREATE INDEX idx_reservations_artist_id ON reservations(artist_id);
CREATE INDEX idx_reservations_status ON reservations(status);
