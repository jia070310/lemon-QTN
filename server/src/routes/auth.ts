import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { authRequired, signToken } from '../auth.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }

  const row = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(parsed.data.username) as
    | {
        id: number;
        username: string;
        password_hash: string;
        display_name: string;
        role: string;
      }
    | undefined;

  if (!row || !bcrypt.compareSync(parsed.data.password, row.password_hash)) {
    return res.status(401).json({ error: '账号或密码错误' });
  }

  const user = {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };

  res.json({ token: signToken(user), user });
});

authRouter.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});
