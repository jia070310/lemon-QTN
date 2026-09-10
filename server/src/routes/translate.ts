import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../auth.js';
import { translateZhToEn } from '../translate.js';

export const translateRouter = Router();
translateRouter.use(authRequired);

translateRouter.post('/', async (req, res) => {
  const parsed = z
    .object({
      texts: z.array(z.string()).max(80),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: '参数无效' });
  }

  try {
    const translations = await translateZhToEn(parsed.data.texts);
    res.json({ translations });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '翻译失败';
    res.status(502).json({ error: msg });
  }
});
