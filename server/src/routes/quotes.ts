import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authRequired } from '../auth.js';
import { calcItemAmount } from '../pricing.js';

export const quotesRouter = Router();
quotesRouter.use(authRequired);

const itemSchema = z.object({
  floor: z.string().default(''),
  area: z.string().default(''),
  type: z.string().default('布'),
  model: z.string().default(''),
  openStyle: z.string().default(''),
  installMethod: z.string().default(''),
  width: z.number().default(0),
  height: z.number().default(0),
  sqm: z.number().optional(),
  unitPrice: z.number().default(0),
  source: z.enum(['brand', 'own']).default('own'),
  brandName: z.string().default(''),
});

const customFeeSchema = z.object({
  name: z.string().default(''),
  amount: z.number().default(0),
});

const quoteSchema = z.object({
  name: z.string().default(''),
  title: z.string().default('JINCHAN CURTAIN QTN [金蝉窗帘报价单]'),
  quoteDate: z.string().min(1),
  customerName: z.string().default(''),
  address: z.string().default(''),
  contact: z.string().default(''),
  includeMeasure: z.boolean().default(true),
  includeProduce: z.boolean().default(true),
  includeInstall: z.boolean().default(true),
  includeHeat: z.boolean().default(true),
  includeOther: z.boolean().default(false),
  otherFeeNote: z.string().default(''),
  customFeeNotes: z.array(z.string()).default(['']),
  otherNotes: z.string().default(''),
  measureUnit: z.enum(['m', 'ft']).default('m'),
  language: z.enum(['zh', 'en', 'both']).default('both'),
  pageOrientation: z.enum(['portrait', 'landscape']).default('portrait'),
  customFees: z.array(customFeeSchema).default([]),
  depositPrevious: z.number().default(0),
  depositCurrent: z.number().default(0),
  items: z.array(itemSchema).default([]),
});

/** 保存报价时：有客户名则写入/更新客户库（按姓名匹配） */
function upsertCustomerFromQuote(customerName: string, contact: string, address: string) {
  const name = customerName.trim();
  if (!name) return;
  const contactVal = contact.trim();
  const addressVal = address.trim();
  const existing = db
    .prepare('SELECT id, contact, address, note FROM customers WHERE name = ? COLLATE NOCASE LIMIT 1')
    .get(name) as { id: number; contact: string; address: string; note: string } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE customers SET
        name = ?,
        contact = ?,
        address = ?,
        enabled = 1,
        updated_at = datetime('now')
      WHERE id = ?`,
    ).run(
      name,
      contactVal || String(existing.contact || ''),
      addressVal || String(existing.address || ''),
      existing.id,
    );
    return;
  }
  db.prepare(
    `INSERT INTO customers (name, contact, address, note, enabled) VALUES (?, ?, ?, '', 1)`,
  ).run(name, contactVal, addressVal);
}

function parseCustomFees(raw: unknown): { name: string; amount: number }[] {
  if (Array.isArray(raw)) return raw as { name: string; amount: number }[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseCustomFeeNotes(row: Record<string, unknown>): string[] {
  const raw = row.custom_fee_notes;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* fall through */
    }
  }
  const legacy = String(row.custom_fee_note || '').trim();
  return legacy ? [legacy] : [''];
}

function mapItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    floor: row.floor,
    area: row.area,
    type: row.type,
    model: row.model,
    openStyle: row.open_style,
    installMethod: row.install_method,
    width: row.width,
    height: row.height,
    sqm: row.sqm,
    unitPrice: row.unit_price,
    amount: row.amount,
    source: row.source === 'brand' ? 'brand' : 'own',
    brandName: row.source === 'brand' ? String(row.brand_name || '') : '',
  };
}

function mapQuote(row: Record<string, unknown>, items: ReturnType<typeof mapItem>[]) {
  return {
    id: row.id,
    name: String(row.name || ''),
    title: row.title,
    quoteDate: row.quote_date,
    customerName: row.customer_name,
    address: row.address,
    contact: row.contact,
    includeMeasure: Boolean(row.include_measure),
    includeProduce: Boolean(row.include_produce),
    includeInstall: Boolean(row.include_install),
    includeHeat: Boolean(row.include_heat),
    includeOther: Boolean(row.include_other),
    otherFeeNote: row.other_fee_note,
    customFeeNotes: parseCustomFeeNotes(row),
    otherNotes: row.other_notes,
    measureUnit: (row.measure_unit as string) === 'ft' ? 'ft' : 'm',
    language:
      row.language === 'zh' || row.language === 'en' || row.language === 'both'
        ? row.language
        : 'both',
    pageOrientation: row.page_orientation === 'landscape' ? 'landscape' : 'portrait',
    customFees: parseCustomFees(row.custom_fees),
    depositPrevious: Number(row.deposit_previous) || 0,
    depositCurrent: Number(row.deposit_current) || 0,
    totalAmount: row.total_amount,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

function loadQuote(id: number) {
  const row = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const items = (
    db
      .prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC')
      .all(id) as Record<string, unknown>[]
  ).map(mapItem);
  return mapQuote(row, items);
}

function normalizeItems(items: z.infer<typeof itemSchema>[]) {
  return items.map((it, index) => {
    const { sqm, amount } = calcItemAmount({
      type: it.type,
      width: it.width,
      height: it.height,
      unitPrice: it.unitPrice,
      sqm: it.sqm,
    });
    return {
      ...it,
      source: it.source === 'brand' ? 'brand' : 'own',
      brandName: it.source === 'brand' ? String(it.brandName || '').trim() : '',
      sortOrder: index,
      sqm,
      amount,
    };
  });
}

quotesRouter.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  let rows: Record<string, unknown>[];
  if (q) {
    const like = `%${q}%`;
    rows = db
      .prepare(
        `SELECT id, name, title, quote_date, customer_name, contact, total_amount, updated_at
         FROM quotes
         WHERE name LIKE ? OR customer_name LIKE ? OR contact LIKE ? OR quote_date LIKE ? OR title LIKE ?
         ORDER BY updated_at DESC LIMIT 200`,
      )
      .all(like, like, like, like, like) as Record<string, unknown>[];
  } else {
    rows = db
      .prepare(
        `SELECT id, name, title, quote_date, customer_name, contact, total_amount, updated_at
         FROM quotes ORDER BY updated_at DESC LIMIT 200`,
      )
      .all() as Record<string, unknown>[];
  }
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      name: String(r.name || ''),
      title: r.title,
      quoteDate: r.quote_date,
      customerName: r.customer_name,
      contact: r.contact,
      totalAmount: r.total_amount,
      updatedAt: r.updated_at,
    })),
  });
});

quotesRouter.get('/:id', (req, res) => {
  const quote = loadQuote(Number(req.params.id));
  if (!quote) return res.status(404).json({ error: '报价单不存在' });
  res.json({ item: quote });
});

quotesRouter.post('/', (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数无效', details: parsed.error.flatten() });
  }
  const d = parsed.data;
  const items = normalizeItems(d.items);
  const feesTotal = Math.round(
    d.customFees.reduce((s, f) => s + (Number(f.amount) || 0), 0) * 100,
  ) / 100;
  const total =
    Math.round((items.reduce((s, it) => s + it.amount, 0) + feesTotal) * 100) / 100;
  const customFeesJson = JSON.stringify(
    d.customFees.map((f) => ({
      name: f.name.trim(),
      amount: Math.round((Number(f.amount) || 0) * 100) / 100,
    })),
  );
  const customFeeNotesJson = JSON.stringify(
    (d.customFeeNotes.length ? d.customFeeNotes : ['']).map((n) => String(n)),
  );

  const insertQuote = db.prepare(`
    INSERT INTO quotes (
      name, title, quote_date, customer_name, address, contact,
      include_measure, include_produce, include_install, include_heat, include_other,
      other_fee_note, custom_fee_notes, other_notes, measure_unit, language, page_orientation, custom_fees,
      deposit_previous, deposit_current, total_amount, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO quote_items (
      quote_id, sort_order, floor, area, type, model, open_style, install_method,
      width, height, sqm, unit_price, amount, source, brand_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    const info = insertQuote.run(
      d.name.trim(),
      d.title,
      d.quoteDate,
      d.customerName,
      d.address,
      d.contact,
      d.includeMeasure ? 1 : 0,
      d.includeProduce ? 1 : 0,
      d.includeInstall ? 1 : 0,
      d.includeHeat ? 1 : 0,
      d.includeOther ? 1 : 0,
      d.otherFeeNote,
      customFeeNotesJson,
      d.otherNotes,
      d.measureUnit,
      d.language,
      d.pageOrientation,
      customFeesJson,
      Number(d.depositPrevious) || 0,
      Number(d.depositCurrent) || 0,
      total,
      req.user!.id,
    );
    const quoteId = Number(info.lastInsertRowid);
    for (const it of items) {
      insertItem.run(
        quoteId,
        it.sortOrder,
        it.floor,
        it.area,
        it.type,
        it.model,
        it.openStyle,
        it.installMethod,
        it.width,
        it.height,
        it.sqm,
        it.unitPrice,
        it.amount,
        it.source === 'brand' ? 'brand' : 'own',
        it.source === 'brand' ? String(it.brandName || '').trim() : '',
      );
    }
    upsertCustomerFromQuote(d.customerName, d.contact, d.address);
    db.exec('COMMIT');
    res.status(201).json({ item: loadQuote(quoteId) });
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
});

quotesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!loadQuote(id)) return res.status(404).json({ error: '报价单不存在' });

  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数无效' });
  }
  const d = parsed.data;
  const items = normalizeItems(d.items);
  const feesTotal = Math.round(
    d.customFees.reduce((s, f) => s + (Number(f.amount) || 0), 0) * 100,
  ) / 100;
  const total =
    Math.round((items.reduce((s, it) => s + it.amount, 0) + feesTotal) * 100) / 100;
  const customFeesJson = JSON.stringify(
    d.customFees.map((f) => ({
      name: f.name.trim(),
      amount: Math.round((Number(f.amount) || 0) * 100) / 100,
    })),
  );
  const customFeeNotesJson = JSON.stringify(
    (d.customFeeNotes.length ? d.customFeeNotes : ['']).map((n) => String(n)),
  );

  const updateQuote = db.prepare(`
    UPDATE quotes SET
      name=?, title=?, quote_date=?, customer_name=?, address=?, contact=?,
      include_measure=?, include_produce=?, include_install=?, include_heat=?, include_other=?,
      other_fee_note=?, custom_fee_notes=?, other_notes=?, measure_unit=?, language=?, page_orientation=?, custom_fees=?,
      deposit_previous=?, deposit_current=?, total_amount=?, updated_at=datetime('now')
    WHERE id=?
  `);
  const deleteItems = db.prepare('DELETE FROM quote_items WHERE quote_id = ?');
  const insertItem = db.prepare(`
    INSERT INTO quote_items (
      quote_id, sort_order, floor, area, type, model, open_style, install_method,
      width, height, sqm, unit_price, amount, source, brand_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    updateQuote.run(
      d.name.trim(),
      d.title,
      d.quoteDate,
      d.customerName,
      d.address,
      d.contact,
      d.includeMeasure ? 1 : 0,
      d.includeProduce ? 1 : 0,
      d.includeInstall ? 1 : 0,
      d.includeHeat ? 1 : 0,
      d.includeOther ? 1 : 0,
      d.otherFeeNote,
      customFeeNotesJson,
      d.otherNotes,
      d.measureUnit,
      d.language,
      d.pageOrientation,
      customFeesJson,
      Number(d.depositPrevious) || 0,
      Number(d.depositCurrent) || 0,
      total,
      id,
    );
    deleteItems.run(id);
    for (const it of items) {
      insertItem.run(
        id,
        it.sortOrder,
        it.floor,
        it.area,
        it.type,
        it.model,
        it.openStyle,
        it.installMethod,
        it.width,
        it.height,
        it.sqm,
        it.unitPrice,
        it.amount,
        it.source === 'brand' ? 'brand' : 'own',
        it.source === 'brand' ? String(it.brandName || '').trim() : '',
      );
    }
    upsertCustomerFromQuote(d.customerName, d.contact, d.address);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ item: loadQuote(id) });
});

quotesRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM quotes WHERE id = ?').run(id);
  res.json({ ok: true });
});

quotesRouter.post('/:id/duplicate', (req, res) => {
  const src = loadQuote(Number(req.params.id));
  if (!src) return res.status(404).json({ error: '报价单不存在' });

  const nameBase = String(src.name || src.customerName || '报价单').trim() || '报价单';
  const copyName = `${nameBase} (副本)`;
  const items = (src.items || []).map((it: Record<string, unknown>, index: number) => ({
    floor: String(it.floor || ''),
    area: String(it.area || ''),
    type: String(it.type || '布'),
    model: String(it.model || ''),
    openStyle: String(it.openStyle || ''),
    installMethod: String(it.installMethod || ''),
    width: Number(it.width) || 0,
    height: Number(it.height) || 0,
    sqm: Number(it.sqm) || 0,
    unitPrice: Number(it.unitPrice) || 0,
    amount: Number(it.amount) || 0,
    source: it.source === 'brand' ? 'brand' : 'own',
    brandName: it.source === 'brand' ? String(it.brandName || '').trim() : '',
    sortOrder: index,
  }));
  const customFeesJson = JSON.stringify(src.customFees || []);
  const customFeeNotesJson = JSON.stringify(
    Array.isArray(src.customFeeNotes) && src.customFeeNotes.length ? src.customFeeNotes : [''],
  );

  const insertQuote = db.prepare(`
    INSERT INTO quotes (
      name, title, quote_date, customer_name, address, contact,
      include_measure, include_produce, include_install, include_heat, include_other,
      other_fee_note, custom_fee_notes, other_notes, measure_unit, language, page_orientation, custom_fees,
      deposit_previous, deposit_current, total_amount, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO quote_items (
      quote_id, sort_order, floor, area, type, model, open_style, install_method,
      width, height, sqm, unit_price, amount, source, brand_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    const info = insertQuote.run(
      copyName,
      String(src.title || ''),
      String(src.quoteDate || ''),
      String(src.customerName || ''),
      String(src.address || ''),
      String(src.contact || ''),
      src.includeMeasure ? 1 : 0,
      src.includeProduce ? 1 : 0,
      src.includeInstall ? 1 : 0,
      src.includeHeat ? 1 : 0,
      src.includeOther ? 1 : 0,
      String(src.otherFeeNote || ''),
      customFeeNotesJson,
      String(src.otherNotes || ''),
      String(src.measureUnit || 'm'),
      String(src.language || 'both'),
      src.pageOrientation === 'landscape' ? 'landscape' : 'portrait',
      customFeesJson,
      Number(src.depositPrevious) || 0,
      Number(src.depositCurrent) || 0,
      Number(src.totalAmount) || 0,
      req.user!.id,
    );
    const quoteId = Number(info.lastInsertRowid);
    for (const it of items) {
      insertItem.run(
        quoteId,
        it.sortOrder,
        it.floor,
        it.area,
        it.type,
        it.model,
        it.openStyle,
        it.installMethod,
        it.width,
        it.height,
        it.sqm,
        it.unitPrice,
        it.amount,
        it.source === 'brand' ? 'brand' : 'own',
        it.source === 'brand' ? String(it.brandName || '').trim() : '',
      );
    }
    db.exec('COMMIT');
    res.status(201).json({ item: loadQuote(quoteId) });
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
});
