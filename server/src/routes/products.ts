import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authRequired } from '../auth.js';

export const productsRouter = Router();
productsRouter.use(authRequired);

const productSchema = z.object({
  code: z.string().min(1),
  type: z.string().default('布'),
  defaultUnitPrice: z.number().default(0),
  defaultOpenStyle: z.string().default(''),
  defaultInstallMethod: z.string().default(''),
  note: z.string().default(''),
  enabled: z.boolean().default(true),
});

function mapProduct(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    defaultUnitPrice: row.default_unit_price,
    defaultOpenStyle: row.default_open_style,
    defaultInstallMethod: row.default_install_method,
    note: row.note,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

productsRouter.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  const includeDisabled = req.query.all === '1';
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params: unknown[] = [];
  if (!includeDisabled) {
    sql += ' AND enabled = 1';
  }
  if (q) {
    sql += ' AND (code LIKE ? OR note LIKE ? OR type LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY code ASC LIMIT 200';
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  res.json({ items: rows.map(mapProduct) });
});

productsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id)) as
    | Record<string, unknown>
    | undefined;
  if (!row) return res.status(404).json({ error: '型号不存在' });
  res.json({ item: mapProduct(row) });
});

productsRouter.post('/', (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数无效', details: parsed.error.flatten() });
  }
  const d = parsed.data;
  try {
    const info = db
      .prepare(
        `INSERT INTO products (code, type, default_unit_price, default_open_style, default_install_method, note, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        d.code.trim(),
        d.type,
        d.defaultUnitPrice,
        d.defaultOpenStyle,
        d.defaultInstallMethod,
        d.note,
        d.enabled ? 1 : 0,
      );
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid) as Record<
      string,
      unknown
    >;
    res.status(201).json({ item: mapProduct(row) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('UNIQUE')) {
      return res.status(409).json({ error: '型号已存在' });
    }
    throw e;
  }
});

productsRouter.put('/:id', (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数无效' });
  }
  const d = parsed.data;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '型号不存在' });

  try {
    db.prepare(
      `UPDATE products SET code=?, type=?, default_unit_price=?, default_open_style=?,
       default_install_method=?, note=?, enabled=?, updated_at=datetime('now') WHERE id=?`,
    ).run(
      d.code.trim(),
      d.type,
      d.defaultUnitPrice,
      d.defaultOpenStyle,
      d.defaultInstallMethod,
      d.note,
      d.enabled ? 1 : 0,
      id,
    );
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({ item: mapProduct(row) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('UNIQUE')) {
      return res.status(409).json({ error: '型号已存在' });
    }
    throw e;
  }
});

productsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE products SET enabled = 0, updated_at=datetime(\'now\') WHERE id = ?').run(id);
  res.json({ ok: true });
});
