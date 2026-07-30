export const operationsSchema = `
  -- Customers
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    customer_number TEXT UNIQUE, -- Business Identifier
    first_name TEXT NOT NULL,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    loyalty_points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Dining Tables
  CREATE TABLE IF NOT EXISTS dining_tables (
    id TEXT PRIMARY KEY,
    table_number TEXT NOT NULL UNIQUE,
    capacity INTEGER DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OCCUPIED', 'RESERVED'
    zone TEXT, -- e.g., 'Main Floor', 'Patio'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Cashier Sessions (Shift Tracking)
  CREATE TABLE IF NOT EXISTS cashier_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    terminal_id TEXT, -- Ties to application_settings terminal config
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    opening_float REAL NOT NULL,
    closing_balance REAL,
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
  );

  CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON cashier_sessions(user_id);
`;
