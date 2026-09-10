import bcrypt from 'bcryptjs';
import { db, initDb } from './db.js';

initDb();

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existing) {
  db.prepare(
    `INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)`,
  ).run('admin', bcrypt.hashSync('admin123', 10), '管理员', 'admin');
  console.log('Seeded default user: admin / admin123');
}

const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
if (productCount.c === 0) {
  const insert = db.prepare(
    `INSERT INTO products (code, type, default_unit_price, default_open_style, default_install_method, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const samples: [string, string, number, string, string, string][] = [
    ['JCB60M-10', '布', 380, '对开', '顶装双轨', '示例布帘'],
    ['cx526', '纱', 120, '对开', '顶装双轨', '示例纱帘'],
    ['LG72802', '百叶', 85, '上下拉', '侧装轨道', '示例百叶'],
  ];
  for (const s of samples) insert.run(...s);
  console.log('Seeded sample products');
}

const optCount = db.prepare('SELECT COUNT(*) as c FROM dict_options').get() as { c: number };
if (optCount.c === 0) {
  const insertOpt = db.prepare(
    `INSERT INTO dict_options (category, label, label_en, sort_order) VALUES (?, ?, ?, ?)`,
  );
  const defaults: [string, string, string, number][] = [
    ['type', '布', 'Cloth', 1],
    ['type', '纱', 'Sheer', 2],
    ['type', '百叶', 'Blinds', 3],
    ['open_style', '对开', 'Center open', 1],
    ['open_style', '左单开', 'Left single', 2],
    ['open_style', '右单开', 'Right single', 3],
    ['open_style', '上下拉', 'Up-down', 4],
    ['install_method', '顶装双轨', 'Ceiling double track', 1],
    ['install_method', '顶装轨道', 'Ceiling track', 2],
    ['install_method', '侧装轨道', 'Side track', 3],
    ['install_method', '顶装单轨', 'Ceiling single track', 4],
  ];
  for (const row of defaults) insertOpt.run(...row);
  console.log('Seeded dict options');
}
