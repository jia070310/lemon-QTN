import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import type { DictCategory, DictOption } from '../types';
import { DICT_CATEGORY_LABELS } from '../types';

const CATEGORIES: DictCategory[] = ['type', 'open_style', 'install_method'];

export function OptionsPage() {
  const { isAdmin } = useAuth();
  const [category, setCategory] = useState<DictCategory>('type');
  const [items, setItems] = useState<DictOption[]>([]);
  const [label, setLabel] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function load(cat = category) {
    const { items } = await api.listOptions(cat, '', true);
    setItems(items);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [category]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) {
      setError('需要管理员权限才能维护选项');
      return;
    }
    setError('');
    setMsg('');
    try {
      if (editingId) {
        await api.updateOption(editingId, { category, label, labelEn });
        setMsg('已更新');
      } else {
        await api.createOption({ category, label, labelEn });
        setMsg('已新增');
      }
      setLabel('');
      setLabelEn('');
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  function startEdit(item: DictOption) {
    if (!isAdmin) return;
    setEditingId(item.id);
    setLabel(item.label);
    setLabelEn(item.labelEn || '');
  }

  async function remove(id: number) {
    if (!isAdmin) return;
    if (!confirm('停用该选项？')) return;
    await api.deleteOption(id);
    await load();
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="muted page-desc">
          {isAdmin
            ? '维护类型 / 窗帘方式 / 安装方式等下拉选项'
            : '可查看选项字典；增改需管理员权限'}
        </p>
        <div className="row tabs">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={category === c ? 'primary' : 'secondary'}
              onClick={() => {
                setCategory(c);
                setEditingId(null);
                setLabel('');
                setLabelEn('');
              }}
            >
              {DICT_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}

      {isAdmin && (
        <form className="product-form panel" onSubmit={submit}>
          <h3>{editingId ? '编辑选项' : `新增${DICT_CATEGORY_LABELS[category]}`}</h3>
          <div className="grid-form">
            <label>
              中文名称 *
              <input required value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <label>
              英文名称
              <input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} />
            </label>
          </div>
          <div className="row">
            <button type="submit">{editingId ? '保存修改' : '加入选项'}</button>
            {editingId && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditingId(null);
                  setLabel('');
                  setLabelEn('');
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
              <th>中文</th>
              <th>英文</th>
              <th>状态</th>
              {isAdmin && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 4 : 3}>
                  <div className="empty-state">
                    <strong>暂无选项</strong>
                    可在上方新增常用选项
                  </div>
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className={item.enabled ? '' : 'disabled-row'}>
                <td>{item.label}</td>
                <td>{item.labelEn || '—'}</td>
                <td>{item.enabled ? '启用' : '停用'}</td>
                {isAdmin && (
                  <td className="row">
                    <button type="button" className="link" onClick={() => startEdit(item)}>
                      编辑
                    </button>
                    {item.enabled && (
                      <button type="button" className="link danger" onClick={() => remove(item.id)}>
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
