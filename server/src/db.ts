import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const dbPath = path.join(dataDir, 'quote.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

export function initDb() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT '布',
      default_unit_price REAL NOT NULL DEFAULT 0,
      default_open_style TEXT NOT NULL DEFAULT '',
      default_install_method TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'own',
      brand_name TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT 'JINCHAN CURTAIN QTN [金蝉窗帘报价单]',
      quote_date TEXT NOT NULL,
      customer_name TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      include_measure INTEGER NOT NULL DEFAULT 1,
      include_produce INTEGER NOT NULL DEFAULT 1,
      include_install INTEGER NOT NULL DEFAULT 1,
      include_heat INTEGER NOT NULL DEFAULT 1,
      include_other INTEGER NOT NULL DEFAULT 0,
      other_fee_note TEXT NOT NULL DEFAULT '',
      custom_fee_notes TEXT NOT NULL DEFAULT '[""]',
      other_notes TEXT NOT NULL DEFAULT '1. 尺寸以实际测量为准；\n2. 面料、颜色、款式以客户选定为准；',
      measure_unit TEXT NOT NULL DEFAULT 'm',
      language TEXT NOT NULL DEFAULT 'both',
      custom_fees TEXT NOT NULL DEFAULT '[]',
      deposit_previous REAL NOT NULL DEFAULT 0,
      deposit_current REAL NOT NULL DEFAULT 0,
      page_orientation TEXT NOT NULL DEFAULT 'portrait',
      total_amount REAL NOT NULL DEFAULT 0,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      floor TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '布',
      model TEXT NOT NULL DEFAULT '',
      open_style TEXT NOT NULL DEFAULT '',
      install_method TEXT NOT NULL DEFAULT '',
      width REAL NOT NULL DEFAULT 0,
      height REAL NOT NULL DEFAULT 0,
      sqm REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'own',
      brand_name TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
    CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);

    CREATE TABLE IF NOT EXISTS dict_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      label_en TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(category, label)
    );

    CREATE INDEX IF NOT EXISTS idx_dict_category ON dict_options(category);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
  `);

  // migrate existing DBs
  const cols = db.prepare(`PRAGMA table_info(quotes)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === 'measure_unit')) {
    db.exec(`ALTER TABLE quotes ADD COLUMN measure_unit TEXT NOT NULL DEFAULT 'm'`);
  }
  if (!cols.some((c) => c.name === 'custom_fees')) {
    db.exec(`ALTER TABLE quotes ADD COLUMN custom_fees TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!cols.some((c) => c.name === 'custom_fee_notes')) {
    db.exec(`ALTER TABLE quotes ADD COLUMN custom_fee_notes TEXT NOT NULL DEFAULT '[""]'`);
  }
  if (!cols.some((c) => c.name === 'language')) {
    db.exec(`ALTER TABLE quotes ADD COLUMN language TEXT NOT NULL DEFAULT 'both'`);
  }
  if (!cols.some((c) => c.name === 'name')) {
    db.exec(`ALTER TABLE quotes ADD COLUMN name TEXT NOT NULL DEFAULT ''`);
  }
  if (!cols.some((c) => c.name === 'deposit_previous')) {
    db.exec(`ALTER TABLE quotes ADD COLUMN deposit_previous REAL NOT NULL DEFAULT 0`);
  }
  if (!cols.some((c) => c.name === 'deposit_current')) {
    db.exec(`ALTER TABLE quotes ADD COLUMN deposit_current REAL NOT NULL DEFAULT 0`);
  }
  if (!cols.some((c) => c.name === 'page_orientation')) {
    db.exec(`ALTER TABLE quotes ADD COLUMN page_orientation TEXT NOT NULL DEFAULT 'portrait'`);
  }

  const itemCols = db.prepare(`PRAGMA table_info(quote_items)`).all() as { name: string }[];
  if (!itemCols.some((c) => c.name === 'source')) {
    db.exec(`ALTER TABLE quote_items ADD COLUMN source TEXT NOT NULL DEFAULT 'own'`);
  }
  if (!itemCols.some((c) => c.name === 'brand_name')) {
    db.exec(`ALTER TABLE quote_items ADD COLUMN brand_name TEXT NOT NULL DEFAULT ''`);
  }

  const productCols = db.prepare(`PRAGMA table_info(products)`).all() as { name: string }[];
  if (!productCols.some((c) => c.name === 'source')) {
    db.exec(`ALTER TABLE products ADD COLUMN source TEXT NOT NULL DEFAULT 'own'`);
  }
  if (!productCols.some((c) => c.name === 'brand_name')) {
    db.exec(`ALTER TABLE products ADD COLUMN brand_name TEXT NOT NULL DEFAULT ''`);
  }

  // migrate legacy single custom_fee_note -> custom_fee_notes
  // refresh cols after potential alters
  const cols2 = db.prepare(`PRAGMA table_info(quotes)`).all() as { name: string }[];
  if (cols2.some((c) => c.name === 'custom_fee_note')) {
    const rows = db
      .prepare(
        `SELECT id, custom_fee_note, custom_fee_notes FROM quotes
         WHERE custom_fee_note IS NOT NULL AND TRIM(custom_fee_note) != ''`,
      )
      .all() as { id: number; custom_fee_note: string; custom_fee_notes: string }[];
    const upd = db.prepare(`UPDATE quotes SET custom_fee_notes = ? WHERE id = ?`);
    for (const row of rows) {
      let notes: string[] = [];
      try {
        const parsed = JSON.parse(row.custom_fee_notes || '[]');
        notes = Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        notes = [];
      }
      const hasContent = notes.some((n) => n.trim());
      if (!hasContent) {
        upd.run(JSON.stringify([row.custom_fee_note]), row.id);
      }
    }
  }
}
