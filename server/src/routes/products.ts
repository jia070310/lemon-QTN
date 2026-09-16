import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { adminRequired, authRequired } from '../auth.js';

export const productsRouter = Router();
productsRouter.use(authRequired);

const productSchema = z.object({
  code: z.string().min(1),
  type: z.string().default('布'),
  defaultUnitPrice: z.number().default(0),
  defaultOpenStyle: z.string().default(''),
  defaultInstallMethod: z.string().default(''),
  note: z.string().default(''),
  source: z.enum(['brand', 'own']).default('own'),
  brandName: z.string().default(''),
  enabled: z.boolean().default(true),
});

function normalizeSource(source: 'brand' | 'own', brandName: string) {
  const src = source === 'brand' ? 'brand' : 'own';
  const brand = src === 'brand' ? brandName.trim() : '';
  return { source: src, brandName: brand };
}

function mapProduct(row: Record<string, unknown>) {
  const source = row.source === 'brand' ? 'brand' : 'own';
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    defaultUnitPrice: row.default_unit_price,
    defaultOpenStyle: row.default_open_style,
    defaultInstallMethod: row.default_install_method,
    note: row.note,
    source,
    brandName: source === 'brand' ? String(row.brand_name || '') : '',
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

productsRouter.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  const includeDisabled = req.query.all === '1';
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params: (string | number)[] = [];
  if (!includeDisabled) {
    sql += ' AND enabled = 1';
  }
  if (q) {
    sql += ' AND (code LIKE ? OR note LIKE ? OR type LIKE ? OR brand_name LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY code ASC LIMIT 500';
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  res.json({ items: rows.map(mapProduct) });
});

productsRouter.get('/brands', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT DISTINCT brand_name AS brandName FROM products
       WHERE source = 'brand' AND TRIM(brand_name) != ''
       ORDER BY brand_name ASC LIMIT 200`,
    )
    .all() as { brandName: string }[];
  res.json({ items: rows.map((r) => String(r.brandName)) });
});

productsRouter.post('/import', adminRequired, (req, res) => {
  const schema = z.object({
    items: z.array(productSchema).min(1),
    updateExisting: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '参数无效' });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const insert = db.prepare(
    `INSERT INTO products (code, type, default_unit_price, default_open_style, default_install_method, note, source, brand_name, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const update = db.prepare(
    `UPDATE products SET type=?, default_unit_price=?, default_open_style=?, default_install_method=?,
     note=?, source=?, brand_name=?, enabled=?, updated_at=datetime('now') WHERE code=?`,
  );
  const find = db.prepare('SELECT id FROM products WHERE code = ?');

  db.exec('BEGIN');
  try {
    for (const d of parsed.data.items) {
      const code = d.code.trim();
      if (!code) {
        skipped += 1;
        continue;
      }
      const { source, brandName } = normalizeSource(d.source, d.brandName);
      if (source === 'brand' && !brandName) {
        skipped += 1;
        continue;
      }
      const exists = find.get(code);
      if (exists) {
        if (parsed.data.updateExisting) {
          update.run(
            d.type,
            d.defaultUnitPrice,
            d.defaultOpenStyle,
            d.defaultInstallMethod,
            d.note,
            source,
            brandName,
            d.enabled ? 1 : 0,
            code,
          );
          updated += 1;
        } else {
          skipped += 1;
        }
      } else {
        insert.run(
          code,
          d.type,
          d.defaultUnitPrice,
          d.defaultOpenStyle,
          d.defaultInstallMethod,
          d.note,
          source,
          brandName,
          d.enabled ? 1 : 0,
        );
        created += 1;
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ created, updated, skipped });
});

productsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id)) as
    | Record<string, unknown>
    | undefined;
  if (!row) return res.status(404).json({ error: '型号不存在' });
  res.json({ item: mapProduct(row) });
});

productsRouter.post('/', adminRequired, (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数无效', details: parsed.error.flatten() });
  }
  const d = parsed.data;
  const { source, brandName } = normalizeSource(d.source, d.brandName);
  if (source === 'brand' && !brandName) {
    return res.status(400).json({ error: '品牌货源请填写品牌名称' });
  }
  try {
    const info = db
      .prepare(
        `INSERT INTO products (code, type, default_unit_price, default_open_style, default_install_method, note, source, brand_name, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        d.code.trim(),
        d.type,
        d.defaultUnitPrice,
        d.defaultOpenStyle,
        d.defaultInstallMethod,
        d.note,
        source,
        brandName,
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

productsRouter.put('/:id', adminRequired, (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数无效' });
  }
  const d = parsed.data;
  const { source, brandName } = normalizeSource(d.source, d.brandName);
  if (source === 'brand' && !brandName) {
    return res.status(400).json({ error: '品牌货源请填写品牌名称' });
  }
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '型号不存在' });

  try {
    db.prepare(
      `UPDATE products SET code=?, type=?, default_unit_price=?, default_open_style=?,
       default_install_method=?, note=?, source=?, brand_name=?, enabled=?, updated_at=datetime('now') WHERE id=?`,
    ).run(
      d.code.trim(),
      d.type,
      d.defaultUnitPrice,
      d.defaultOpenStyle,
      d.defaultInstallMethod,
      d.note,
      source,
      brandName,
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

productsRouter.delete('/:id', adminRequired, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE products SET enabled = 0, updated_at=datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true });
});
