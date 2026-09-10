import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { User } from '../types';

export function UsersPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const { items } = await api.listUsers();
    setItems(items);
  }

  useEffect(() => {
    if (!isAdmin) return;
    load().catch((e) => setError(e.message));
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/quotes" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      if (editingId) {
        await api.updateUser(editingId, {
          displayName: displayName.trim(),
          role,
          password: password.trim() || undefined,
        });
        setMsg('已更新用户');
      } else {
        await api.createUser({
          username: username.trim(),
          password,
          displayName: displayName.trim(),
          role,
        });
        setMsg('已创建用户');
      }
      setUsername('');
      setPassword('');
      setDisplayName('');
      setRole('user');
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  function startEdit(u: User) {
    setEditingId(u.id);
    setUsername(u.username);
    setDisplayName(u.displayName);
    setRole(u.role === 'admin' ? 'admin' : 'user');
    setPassword('');
  }

  async function remove(id: number) {
    if (!confirm('删除该用户？')) return;
    try {
      await api.deleteUser(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="muted page-desc">管理员可创建账号；普通账号不能改型号库 / 选项库 / 公司设置</p>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}

      <form className="panel" onSubmit={submit}>
        <h3>{editingId ? '编辑用户' : '新增用户'}</h3>
        <div className="grid-form">
          <label>
            登录名 *
            <input
              required={!editingId}
              disabled={!!editingId}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            显示名 *
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            {editingId ? '新密码（留空不改）' : '密码 *'}
            <input
              type="password"
              required={!editingId}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            角色
            <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'user')}>
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button type="submit">{editingId ? '保存修改' : '创建用户'}</button>
          {editingId && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEditingId(null);
                setUsername('');
                setPassword('');
                setDisplayName('');
                setRole('user');
              }}
            >
              取消
            </button>
          )}
        </div>
      </form>

      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>登录名</th>
              <th>显示名</th>
              <th>角色</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.displayName}</td>
                <td>{u.role === 'admin' ? '管理员' : '普通用户'}</td>
                <td className="row">
                  <button type="button" className="link" onClick={() => startEdit(u)}>
                    编辑
                  </button>
                  {u.username !== 'admin' && (
                    <button type="button" className="link danger" onClick={() => remove(u.id)}>
                      删除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
