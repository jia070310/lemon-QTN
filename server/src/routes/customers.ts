import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authRequired } from '../auth.js';

export const customersRouter = Router();
customersRouter.use(authRequired);

const schema = z.object({
  name: z.string().min(1),
  contact: z.string().default(''),
  address: z.string().default(''),
  note: z.string().default(''),
  enabled: z.boolean().default(true),
});

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: String(row.name || ''),
    contact: String(row.contact || ''),
    address: String(row.address || ''),
    note: String(row.note || ''),
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

customersRouter.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  const includeDisabled = req.query.all === '1';
  let sql = 'SELECT * FROM customers WHERE 1=1';
  const params: (string | number)[] = [];
  if (!includeDisabled) sql += ' AND enabled = 1';
  if (q) {
    sql += ' AND (name LIKE ? OR contact LIKE ? OR address LIKE ? OR note LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY updated_at DESC LIMIT 200';
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  res.json({ items: rows.map(mapRow) });
});

customersRouter.post('/', (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '参数无效' });
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO customers (name, contact, address, note, enabled) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(d.name.trim(), d.contact.trim(), d.address.trim(), d.note.trim(), d.enabled ? 1 : 0);
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid) as Record<
    string,
    unknown
  >;
  res.status(201).json({ item: mapRow(row) });
});

customersRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '参数无效' });
  const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '客户不存在' });
  const d = parsed.data;
  db.prepare(
    `UPDATE customers SET name=?, contact=?, address=?, note=?, enabled=?, updated_at=datetime('now') WHERE id=?`,
  ).run(d.name.trim(), d.contact.trim(), d.address.trim(), d.note.trim(), d.enabled ? 1 : 0, id);
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({ item: mapRow(row) });
});

customersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`UPDATE customers SET enabled = 0, updated_at=datetime('now') WHERE id = ?`).run(id);
  res.json({ ok: true });
});
