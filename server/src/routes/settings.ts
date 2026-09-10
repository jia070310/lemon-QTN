import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { authRequired } from '../auth.js';

export const settingsRouter = Router();
settingsRouter.use(authRequired);

const COMPANY_KEY = 'company';

export const defaultCompanySettings = {
  phoneLabel: 'JINCHAN CURTAIN(金蝉窗帘)',
  phone: '011-63791268',
  bankName: '华侨银行',
  bankCompany: 'JINCHAN TRADING SDN BHD',
  accountMyr: '787-1159942',
  accountFx: '787-1159950',
  accountFxNote: '（美金、人民币、澳元、新币、欧元）',
  qrLabel: 'TNG收款码（ZHANG HUAJUN）',
  qrImage: '',
};

const companySchema = z.object({
  phoneLabel: z.string().default(defaultCompanySettings.phoneLabel),
  phone: z.string().default(defaultCompanySettings.phone),
  bankName: z.string().default(defaultCompanySettings.bankName),
  bankCompany: z.string().default(defaultCompanySettings.bankCompany),
  accountMyr: z.string().default(defaultCompanySettings.accountMyr),
  accountFx: z.string().default(defaultCompanySettings.accountFx),
  accountFxNote: z.string().default(defaultCompanySettings.accountFxNote),
  qrLabel: z.string().default(defaultCompanySettings.qrLabel),
  qrImage: z.string().default(''),
});

function readCompany() {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(COMPANY_KEY) as
    | { value: string }
    | undefined;
  if (!row?.value) return { ...defaultCompanySettings };
  try {
    const parsed = JSON.parse(row.value);
    return { ...defaultCompanySettings, ...parsed };
  } catch {
    return { ...defaultCompanySettings };
  }
}

settingsRouter.get('/company', (_req, res) => {
  res.json({ item: readCompany() });
});

settingsRouter.put('/company', (req, res) => {
  const parsed = companySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '参数无效', details: parsed.error.flatten() });
  }
  const value = JSON.stringify(parsed.data);
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).run(COMPANY_KEY, value);
  res.json({ item: parsed.data });
});
