import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { QuoteSummary } from '../types';

function displayName(q: QuoteSummary) {
  const n = q.name?.trim();
  if (n) return n;
  if (q.customerName?.trim()) return q.customerName.trim();
  return '未命名报价单';
}

export function QuoteListPage() {
  const [items, setItems] = useState<QuoteSummary[]>([]);
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(q = keyword) {
    const { items } = await api.listQuotes(q);
    setItems(items);
  }

  useEffect(() => {
    setLoading(true);
    load('')
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function search() {
    setError('');
    setLoading(true);
    try {
      await load(keyword);
    } catch (e) {
      setError(e instanceof Error ? e.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('删除该报价单？')) return;
    await api.deleteQuote(id);
    await load();
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="muted page-desc">按报价单名称、客户、联系方式快速查找</p>
        <div className="row">
          <input
            className="search-field"
            placeholder="搜索名称 / 客户 / 电话…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <button type="button" className="secondary" onClick={search}>
            搜索
          </button>
          <Link className="button" to="/quotes/new">
            新建报价单
          </Link>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>报价单名称</th>
              <th>日期</th>
              <th>客户</th>
              <th>联系方式</th>
              <th>总金额</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <strong>{keyword.trim() ? '没有匹配的报价单' : '还没有报价单'}</strong>
                    {keyword.trim()
                      ? '换个关键词试试，或清空搜索查看全部'
                      : '从「新建报价单」开始，并填写报价单名称方便查找'}
                  </div>
                </td>
              </tr>
            )}
            {items.map((q) => (
              <tr key={q.id}>
                <td>
                  <Link className="quote-name-link" to={`/quotes/${q.id}`}>
                    {displayName(q)}
                  </Link>
                  {!q.name?.trim() && q.customerName?.trim() ? (
                    <span className="muted quote-name-fallback">（未设名称）</span>
                  ) : null}
                </td>
                <td>{q.quoteDate}</td>
                <td>{q.customerName || '—'}</td>
                <td>{q.contact || '—'}</td>
                <td className="amount">{q.totalAmount}</td>
                <td className="muted">{q.updatedAt}</td>
                <td className="row">
                  <Link to={`/quotes/${q.id}`}>编辑</Link>
                  <button type="button" className="link danger" onClick={() => remove(q.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
