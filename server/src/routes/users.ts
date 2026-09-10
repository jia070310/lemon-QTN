import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { adminRequired, authRequired } from '../auth.js';

export const usersRouter = Router();
usersRouter.use(authRequired, adminRequired);

function mapUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

usersRouter.get('/', (_req, res) => {
  const rows = db
    .prepare('SELECT id, username, display_name, role, created_at FROM users ORDER BY id ASC')
    .all() as Record<string, unknown>[];
  res.json({ items: rows.map(mapUser) });
});

usersRouter.post('/', (req, res) => {
  const schema = z.object({
    username: z.string().min(2),
    password: z.string().min(4),
    displayName: z.string().min(1),
    role: z.enum(['admin', 'user']).default('user'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '参数无效' });
  const d = parsed.data;
  try {
    const info = db
      .prepare(
        `INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)`,
      )
      .run(d.username.trim(), bcrypt.hashSync(d.password, 10), d.displayName.trim(), d.role);
    const row = db
      .prepare('SELECT id, username, display_name, role, created_at FROM users WHERE id = ?')
      .get(info.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json({ item: mapUser(row) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('UNIQUE')) return res.status(409).json({ error: '用户名已存在' });
    throw e;
  }
});

usersRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    displayName: z.string().min(1),
    role: z.enum(['admin', 'user']),
    password: z.string().min(4).optional().or(z.literal('')),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '参数无效' });
  const existing = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as
    | { id: number; username: string }
    | undefined;
  if (!existing) return res.status(404).json({ error: '用户不存在' });

  const d = parsed.data;
  if (d.password && d.password.length >= 4) {
    db.prepare(
      `UPDATE users SET display_name=?, role=?, password_hash=? WHERE id=?`,
    ).run(d.displayName.trim(), d.role, bcrypt.hashSync(d.password, 10), id);
  } else {
    db.prepare(`UPDATE users SET display_name=?, role=? WHERE id=?`).run(
      d.displayName.trim(),
      d.role,
      id,
    );
  }
  const row = db
    .prepare('SELECT id, username, display_name, role, created_at FROM users WHERE id = ?')
    .get(id) as Record<string, unknown>;
  res.json({ item: mapUser(row) });
});

usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) return res.status(400).json({ error: '不能删除当前登录账号' });
  const row = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as
    | { username: string }
    | undefined;
  if (!row) return res.status(404).json({ error: '用户不存在' });
  if (row.username === 'admin') return res.status(400).json({ error: '不能删除默认管理员' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});
