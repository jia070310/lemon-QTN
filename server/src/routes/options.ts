import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authRequired } from '../auth.js';

export type OptionCategory = 'type' | 'open_style' | 'install_method';

export const optionsRouter = Router();
optionsRouter.use(authRequired);

const categorySchema = z.enum(['type', 'open_style', 'install_method']);

const optionSchema = z.object({
  category: categorySchema,
  label: z.string().min(1),
  labelEn: z.string().default(''),
  enabled: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

function mapOption(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    category: row.category as OptionCategory,
    label: row.label as string,
    labelEn: (row.label_en as string) || '',
    enabled: Boolean(row.enabled),
    sortOrder: row.sort_order as number,
  };
}

optionsRouter.get('/', (req, res) => {
  const category = String(req.query.category || '').trim();
  const q = String(req.query.q || '').trim();
  const all = req.query.all === '1';

  let sql = 'SELECT * FROM dict_options WHERE 1=1';
  const params: unknown[] = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (!all) {
    sql += ' AND enabled = 1';
  }
  if (q) {
    sql += ' AND (label LIKE ? OR label_en LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like);
  }
  sql += ' ORDER BY sort_order ASC, label ASC LIMIT 300';

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  res.json({ items: rows.map(mapOption) });
});

optionsRouter.post('/', (req, res) => {
  const parsed = optionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数无效' });
  }
  const d = parsed.data;
  try {
    const info = db
      .prepare(
        `INSERT INTO dict_options (category, label, label_en, enabled, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(d.category, d.label.trim(), d.labelEn.trim(), d.enabled ? 1 : 0, d.sortOrder);
    const row = db.prepare('SELECT * FROM dict_options WHERE id = ?').get(info.lastInsertRowid) as Record<
      string,
      unknown
    >;
    res.status(201).json({ item: mapOption(row) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('UNIQUE')) {
      return res.status(409).json({ error: '该选项已存在' });
    }
    throw e;
  }
});

optionsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const parsed = optionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数无效' });
  }
  const existing = db.prepare('SELECT id FROM dict_options WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '选项不存在' });

  const d = parsed.data;
  try {
    db.prepare(
      `UPDATE dict_options SET category=?, label=?, label_en=?, enabled=?, sort_order=? WHERE id=?`,
    ).run(d.category, d.label.trim(), d.labelEn.trim(), d.enabled ? 1 : 0, d.sortOrder, id);
    const row = db.prepare('SELECT * FROM dict_options WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({ item: mapOption(row) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('UNIQUE')) {
      return res.status(409).json({ error: '该选项已存在' });
    }
    throw e;
  }
});

optionsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`UPDATE dict_options SET enabled = 0 WHERE id = ?`).run(id);
  res.json({ ok: true });
});
