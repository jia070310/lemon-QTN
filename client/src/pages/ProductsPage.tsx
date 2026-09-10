import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../api';
import { useAuth } from '../auth';
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
  const { isAdmin } = useAuth();
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
    if (!isAdmin) {
      setError('需要管理员权限才能维护型号库');
      return;
    }
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    if (!confirm('停用该型号？')) return;
    await api.deleteProduct(id);
    await load();
  }

  async function importExcel(file: File | null) {
    if (!file || !isAdmin) return;
    setError('');
    setMsg('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const items = rows
        .map((r) => {
          const code = String(r['型号'] ?? r['code'] ?? r['Code'] ?? '').trim();
          if (!code) return null;
          return {
            code,
            type: String(r['类型'] ?? r['type'] ?? '布').trim() || '布',
            defaultUnitPrice: Number(r['默认单价'] ?? r['单价'] ?? r['defaultUnitPrice'] ?? 0) || 0,
            defaultOpenStyle: String(r['窗帘方式'] ?? r['defaultOpenStyle'] ?? '').trim(),
            defaultInstallMethod: String(r['安装方式'] ?? r['defaultInstallMethod'] ?? '').trim(),
            note: String(r['备注'] ?? r['note'] ?? '').trim(),
            enabled: true,
          };
        })
        .filter(Boolean) as Array<Partial<Product> & { code: string }>;
      if (!items.length) {
        setError('表格中未识别到型号列（需要「型号」或 code）');
        return;
      }
      const res = await api.importProducts(items, true);
      setMsg(`导入完成：新增 ${res.created}，更新 ${res.updated}，跳过 ${res.skipped}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="muted page-desc">
          {isAdmin
            ? '维护布艺 / 纱帘 / 百叶等常用型号；支持 Excel 批量导入'
            : '可查看型号库；增改需管理员权限'}
        </p>
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
          {isAdmin && (
            <label className="button secondary" style={{ cursor: 'pointer' }}>
              导入 Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => {
                  void importExcel(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}
      {isAdmin && (
        <p className="hint">Excel 表头建议：型号、类型、默认单价、窗帘方式、安装方式、备注</p>
      )}

      {isAdmin && (
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
      )}

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
              {isAdmin && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6}>
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
                {isAdmin && (
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
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
