import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import './seed.js';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { quotesRouter } from './routes/quotes.js';
import { translateRouter } from './routes/translate.js';
import { optionsRouter } from './routes/options.js';
import { settingsRouter } from './routes/settings.js';

initDb();

const app = express();
const PORT = Number(process.env.PORT || 3780);

app.use(cors());
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/translate', translateRouter);
app.use('/api/options', optionsRouter);
app.use('/api/settings', settingsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: '服务器错误' });
});

app.listen(PORT, () => {
  console.log(`Quote API listening on http://127.0.0.1:${PORT}`);
});
