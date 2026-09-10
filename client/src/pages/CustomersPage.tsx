import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { Customer } from '../types';

const blank = (): Omit<Customer, 'id'> => ({
  name: '',
  contact: '',
  address: '',
  note: '',
  enabled: true,
});

export function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function load(keyword = q) {
    const { items } = await api.listCustomers(keyword, true);
    setItems(items);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      if (editingId) {
        await api.updateCustomer(editingId, form);
        setMsg('已更新');
      } else {
        await api.createCustomer(form);
        setMsg('已新增');
      }
      setForm(blank());
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  function startEdit(c: Customer) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      contact: c.contact,
      address: c.address,
      note: c.note,
      enabled: c.enabled,
    });
  }

  async function remove(id: number) {
    if (!confirm('停用该客户？')) return;
    await api.deleteCustomer(id);
    await load();
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="muted page-desc">维护常用客户，报价时可一键带入姓名 / 电话 / 地址</p>
        <div className="row">
          <input
            className="search-field"
            placeholder="搜索客户"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <button type="button" className="secondary" onClick={() => load()}>
            搜索
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}

      <form className="panel" onSubmit={submit}>
        <h3>{editingId ? '编辑客户' : '新增客户'}</h3>
        <div className="grid-form">
          <label>
            客户名 *
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            联系方式
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
          </label>
          <label className="span-2">
            地址
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label className="span-2">
            备注
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
        </div>
        <div className="row">
          <button type="submit">{editingId ? '保存修改' : '加入客户库'}</button>
          {editingId && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEditingId(null);
                setForm(blank());
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
              <th>客户</th>
              <th>联系方式</th>
              <th>地址</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <strong>暂无客户</strong>
                    添加后可在报价单抬头快速选用
                  </div>
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className={c.enabled ? '' : 'disabled-row'}>
                <td>{c.name}</td>
                <td>{c.contact || '—'}</td>
                <td>{c.address || '—'}</td>
                <td>{c.enabled ? '启用' : '停用'}</td>
                <td className="row">
                  <button type="button" className="link" onClick={() => startEdit(c)}>
                    编辑
                  </button>
                  {c.enabled && (
                    <button type="button" className="link danger" onClick={() => remove(c.id)}>
                      停用
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
