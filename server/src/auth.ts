import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'jinchan-quote-dev-secret-change-me';

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  role: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: '登录已失效' });
  }
}

export function adminRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: '未登录' });
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

export { JWT_SECRET };
