import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { DictOption, Product } from '../types';
import { TYPE_OPTIONS, OPEN_STYLE_OPTIONS, INSTALL_OPTIONS } from '../types';

const blank = (): Omit<Product, 'id' | 'enabled'> & { enabled: boolean } => ({
  code: '',
  type: '布',
  defaultUnitPrice: 0,
  defaultOpenStyle: '对开',
  defaultInstallMethod: '顶装双轨',
  note: '',
  enabled: true,
});

export function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [typeOpts, setTypeOpts] = useState<string[]>(TYPE_OPTIONS);
  const [openOpts, setOpenOpts] = useState<string[]>(OPEN_STYLE_OPTIONS.filter(Boolean));
  const [installOpts, setInstallOpts] = useState<string[]>(INSTALL_OPTIONS.filter(Boolean));

  async function load(keyword = q) {
    const { items } = await api.listProducts(keyword, true);
    setItems(items);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    Promise.all([
      api.listOptions('type'),
      api.listOptions('open_style'),
      api.listOptions('install_method'),
    ])
      .then(([t, o, i]) => {
        if (t.items.length) setTypeOpts(t.items.map((x: DictOption) => x.label));
        if (o.items.length) setOpenOpts(o.items.map((x: DictOption) => x.label));
        if (i.items.length) setInstallOpts(i.items.map((x: DictOption) => x.label));
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      if (editingId) {
        await api.updateProduct(editingId, form);
        setMsg('已更新');
      } else {
        await api.createProduct(form);
        setMsg('已新增');
      }
      setForm(blank());
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      code: p.code,
      type: p.type,
      defaultUnitPrice: p.defaultUnitPrice,
      defaultOpenStyle: p.defaultOpenStyle,
      defaultInstallMethod: p.defaultInstallMethod,
      note: p.note,
      enabled: p.enabled,
    });
  }

  async function remove(id: number) {
    if (!confirm('停用该型号？')) return;
    await api.deleteProduct(id);
    await load();
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="muted page-desc">维护布艺 / 纱帘 / 百叶等常用型号与默认价</p>
        <div className="row">
          <input
            className="search-field"
            placeholder="搜索型号"
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

      <form className="product-form panel" onSubmit={submit}>
        <h3>{editingId ? '编辑型号' : '新增型号'}</h3>
        <div className="grid-form">
          <label>
            型号 *
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label>
            类型
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {typeOpts.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            默认单价 (RM)
            <input
              type="number"
              step="0.01"
              value={form.defaultUnitPrice}
              onChange={(e) => setForm({ ...form, defaultUnitPrice: Number(e.target.value) })}
            />
          </label>
          <label>
            默认窗帘方式
            <select
              value={form.defaultOpenStyle}
              onChange={(e) => setForm({ ...form, defaultOpenStyle: e.target.value })}
            >
              <option value="">（空）</option>
              {openOpts.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            默认安装方式
            <select
              value={form.defaultInstallMethod}
              onChange={(e) => setForm({ ...form, defaultInstallMethod: e.target.value })}
            >
              <option value="">（空）</option>
              {installOpts.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            备注
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
        </div>
        <div className="row">
          <button type="submit">{editingId ? '保存修改' : '加入型号库'}</button>
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
              <th>型号</th>
              <th>类型</th>
              <th>默认单价</th>
              <th>窗帘方式</th>
              <th>安装方式</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <strong>型号库为空</strong>
                    在上方表单加入常用布艺 / 纱帘 / 百叶型号
                  </div>
                </td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className={p.enabled ? '' : 'disabled-row'}>
                <td>{p.code}</td>
                <td>{p.type}</td>
                <td className="amount">{p.defaultUnitPrice}</td>
                <td>{p.defaultOpenStyle}</td>
                <td>{p.defaultInstallMethod}</td>
                <td>{p.enabled ? '启用' : '停用'}</td>
                <td className="row">
                  <button type="button" className="link" onClick={() => startEdit(p)}>
                    编辑
                  </button>
                  {p.enabled && (
                    <button type="button" className="link danger" onClick={() => remove(p.id)}>
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
