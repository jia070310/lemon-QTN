import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { DictCategory, DictOption } from '../types';
import { DICT_CATEGORY_LABELS } from '../types';
import { mergeOptionValueMap } from '../lib/i18n';

const CATEGORIES: DictCategory[] = ['type', 'open_style', 'install_method'];

export function OptionsPage() {
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
    mergeOptionValueMap(items);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [category]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      if (editingId) {
        await api.updateOption(editingId, {
          category,
          label: label.trim(),
          labelEn: labelEn.trim(),
          enabled: true,
        });
        setMsg('已更新');
      } else {
        await api.createOption({
          category,
          label: label.trim(),
          labelEn: labelEn.trim(),
        });
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

  function startEdit(o: DictOption) {
    setEditingId(o.id);
    setLabel(o.label);
    setLabelEn(o.labelEn);
    setCategory(o.category);
  }

  async function remove(id: number) {
    if (!confirm('停用该选项？')) return;
    await api.deleteOption(id);
    await load();
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="muted page-desc">类型、窗帘方式、安装方式可复用选项</p>
        <div className="seg-tabs" role="tablist" aria-label="选项分类">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              className={category === c ? 'is-active' : ''}
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

      <form className="panel product-form" onSubmit={submit}>
        <h3>
          {editingId ? '编辑' : '新增'}
          {DICT_CATEGORY_LABELS[category]}
        </h3>
        <div className="grid-form">
          <label>
            中文名称 *
            <input required value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label>
            英文名称
            <input
              placeholder="用于英文报价单显示"
              value={labelEn}
              onChange={(e) => setLabelEn(e.target.value)}
            />
          </label>
        </div>
        <div className="row">
          <button type="submit">{editingId ? '保存修改' : '加入选项库'}</button>
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

      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>中文</th>
              <th>英文</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <strong>暂无选项</strong>
                    为类型 / 窗帘方式 / 安装方式维护可复用名称
                  </div>
                </td>
              </tr>
            )}
            {items.map((o) => (
              <tr key={o.id} className={o.enabled ? '' : 'disabled-row'}>
                <td>{o.label}</td>
                <td>{o.labelEn || '—'}</td>
                <td>{o.enabled ? '启用' : '停用'}</td>
                <td className="row">
                  <button type="button" className="link" onClick={() => startEdit(o)}>
                    编辑
                  </button>
                  {o.enabled && (
                    <button type="button" className="link danger" onClick={() => remove(o.id)}>
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
