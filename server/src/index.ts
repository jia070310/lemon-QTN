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
import { customersRouter } from './routes/customers.js';
import { usersRouter } from './routes/users.js';

initDb();

const app = express();
const PORT = Number(process.env.PORT || 3780);

app.use(cors());
app.use(express.json({ limit: '6mb' }));

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>金蝉报价 API</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;line-height:1.6}
a{color:#0b5}code{background:#f3f3f3;padding:.1em .35em;border-radius:4px}</style></head>
<body>
  <h1>这是后端 API（端口 ${PORT}）</h1>
  <p>网页请打开前端：<a href="http://127.0.0.1:5280">http://127.0.0.1:5280</a></p>
  <p>在项目根目录运行 <code>npm run dev</code> 可同时启动前后端。</p>
</body></html>`);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/translate', translateRouter);
app.use('/api/options', optionsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/users', usersRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: '服务器错误' });
});

app.listen(PORT, () => {
  console.log(`Quote API listening on http://127.0.0.1:${PORT}`);
});
