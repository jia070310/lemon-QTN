import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { WorkOrderPreview } from '../components/WorkOrderPreview';
import { exportImage } from '../exports/image';
import { printQuote } from '../exports/print';
import { fromDateInputValue, toDateInputValue } from '../lib/translateQuote';
import { MEASURE_UNIT_OPTIONS, getMeasureLabels } from '../lib/units';
import {
  FLOOR_PRESETS,
  ITEM_SOURCE_OPTIONS,
  WORK_ORDER_LABELS,
  emptyItem,
  filterItemsForWorkOrder,
  normalizeItemSource,
  normalizeBrandName,
  todayDateStr,
  type ItemSource,
  type MeasureUnit,
  type PageOrientation,
  type QuoteSummary,
  type WorkOrderKind,
  type WorkOrderLine,
} from '../types';

function quoteLabel(q: QuoteSummary) {
  const name = (q.name || q.customerName || `报价#${q.id}`).trim();
  return `${name} · ${q.quoteDate}`;
}

function blankLine(): WorkOrderLine {
  return { ...emptyItem(), fromQuote: '手工' };
}

export function WorkOrdersPage() {
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [q, setQ] = useState('');
  const [pickedQuoteIds, setPickedQuoteIds] = useState<Set<number>>(() => new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [header, setHeader] = useState({
    quoteDate: todayDateStr(),
    customerName: '',
    address: '',
    contact: '',
    name: '',
    measureUnit: 'm' as MeasureUnit,
    pageOrientation: 'portrait' as PageOrientation,
  });
  const [lines, setLines] = useState<WorkOrderLine[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set());
  const [workOrder, setWorkOrder] = useState<{
    kind: WorkOrderKind;
    items: WorkOrderLine[];
  } | null>(null);
  const workOrderRef = useRef<HTMLDivElement>(null);

  const labels = getMeasureLabels(header.measureUnit);

  async function loadQuotes(keyword = q) {
    const { items } = await api.listQuotes(keyword);
    setQuotes(items);
  }

  useEffect(() => {
    loadQuotes().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setSelectedRows((prev) => {
      const next = new Set<number>();
      for (const i of prev) if (i < lines.length) next.add(i);
      return next;
    });
  }, [lines.length]);

  const allQuotesSelected = useMemo(
    () => quotes.length > 0 && quotes.every((x) => pickedQuoteIds.has(x.id)),
    [quotes, pickedQuoteIds],
  );

  function toggleQuote(id: number) {
    setPickedQuoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllQuotes() {
    if (allQuotesSelected) setPickedQuoteIds(new Set());
    else setPickedQuoteIds(new Set(quotes.map((x) => x.id)));
  }

  async function importSelectedQuotes() {
    setError('');
    setMsg('');
    if (pickedQuoteIds.size === 0) {
      setError('请先勾选要合并的报价单');
      return;
    }
    setImporting(true);
    try {
      const ids = [...pickedQuoteIds];
      const loaded = await Promise.all(ids.map((id) => api.getQuote(id)));
      const incoming: WorkOrderLine[] = [];
      const first = loaded[0]?.item;

      for (const { item } of loaded) {
        const label = (item.name || item.customerName || `报价#${item.id}`).trim();
        for (const it of item.items || []) {
          incoming.push({
            ...emptyItem(),
            ...it,
            source: normalizeItemSource(it.source),
            brandName: normalizeBrandName(normalizeItemSource(it.source), it.brandName),
            fromQuote: label,
            fromQuoteId: item.id,
          });
        }
      }
      if (!incoming.length) {
        setError('所选报价单没有明细行');
        return;
      }
      if (first && !header.customerName.trim() && !header.address.trim()) {
        setHeader((h) => ({
          ...h,
          customerName: h.customerName || first.customerName || '',
          address: h.address || first.address || '',
          contact: h.contact || first.contact || '',
          measureUnit: first.measureUnit === 'ft' ? 'ft' : h.measureUnit,
          name: h.name || (ids.length > 1 ? `合并制作（${ids.length}单）` : (first.name || first.customerName || '')),
        }));
      }
      setLines((prev) => [...prev, ...incoming]);
      setMsg(`已导入 ${incoming.length} 行（来自 ${ids.length} 张报价）`);
      setPickedQuoteIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setImporting(false);
    }
  }

  function updateLine(index: number, patch: Partial<WorkOrderLine>) {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addBlankLine() {
    setLines((prev) => [...prev, blankLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setSelectedRows((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i === index) continue;
        next.add(i > index ? i - 1 : i);
      }
      return next;
    });
  }

  function toggleRow(index: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleSelectAllRows() {
    setSelectedRows((prev) =>
      prev.size === lines.length ? new Set() : new Set(lines.map((_, i) => i)),
    );
  }

  function clearDraft() {
    if (lines.length && !confirm('清空当前草稿全部明细？')) return;
    setLines([]);
    setSelectedRows(new Set());
    setWorkOrder(null);
    setMsg('已清空草稿');
  }

  function makeWorkOrder(kind: WorkOrderKind) {
    setError('');
    setMsg('');
    if (selectedRows.size === 0) {
      setError('请先勾选要导出的明细行');
      return;
    }
    const items = filterItemsForWorkOrder(lines, [...selectedRows], kind);
    if (!items.length) {
      setError(
        kind === 'brand'
          ? '勾选行中没有「品牌」货源'
          : kind === 'fabric'
            ? '勾选行中没有「自有」货源'
            : '没有可用明细',
      );
      return;
    }
    setWorkOrder({ kind, items });
    setMsg(`已生成${WORK_ORDER_LABELS[kind]}（${items.length} 行）`);
  }

  function handlePrint() {
    if (!workOrder) return;
    requestAnimationFrame(() =>
      printQuote(header.pageOrientation === 'landscape' ? 'landscape' : 'portrait'),
    );
  }

  async function handleImage() {
    if (!workOrder) return;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const el = workOrderRef.current?.querySelector('.quote-sheet') as HTMLElement | null;
    if (!el) {
      setError('预览未就绪');
      return;
    }
    try {
      await exportImage(el, {
        customerName: `${header.customerName || '作业单'}-${WORK_ORDER_LABELS[workOrder.kind]}`,
        quoteDate: header.quoteDate,
        name: header.name,
        title: WORK_ORDER_LABELS[workOrder.kind],
        address: header.address,
        contact: header.contact,
        measureUnit: header.measureUnit,
        language: 'both',
        pageOrientation: header.pageOrientation,
        includeMeasure: false,
        includeProduce: false,
        includeInstall: false,
        includeHeat: false,
        includeOther: false,
        otherFeeNote: '',
        customFeeNotes: [''],
        otherNotes: '',
        customFees: [],
        depositPrevious: 0,
        depositCurrent: 0,
        totalAmount: 0,
        items: [],
      });
      setMsg('图片已导出');
    } catch (e) {
      setError(e instanceof Error ? e.message : '出图失败');
    }
  }

  const previewQuote = {
    ...header,
    name: header.name,
  };

  return (
    <div className="page">
      <div className="page-head">
        <p className="muted page-desc">
          从多张报价合并明细，勾选后分别制作品牌报单 / 下料单 / 工厂制作单（不含价格）
        </p>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}

      <section className="panel no-print">
        <h3>1. 选择报价单并导入</h3>
        <div className="row" style={{ marginBottom: '0.75rem' }}>
          <input
            className="search-field"
            placeholder="搜索报价单名称 / 客户"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadQuotes()}
          />
          <button type="button" className="secondary" onClick={() => loadQuotes()}>
            搜索
          </button>
          <button type="button" disabled={importing} onClick={importSelectedQuotes}>
            {importing ? '导入中…' : `导入勾选（${pickedQuoteIds.size}）`}
          </button>
        </div>
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={allQuotesSelected}
                    onChange={toggleAllQuotes}
                    aria-label="全选报价"
                  />
                </th>
                <th>名称 / 客户</th>
                <th>日期</th>
                <th>金额</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">
                      <strong>暂无报价单</strong>
                      先去报价单模块建单后再来合并
                    </div>
                  </td>
                </tr>
              )}
              {quotes.map((item) => (
                <tr key={item.id}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={pickedQuoteIds.has(item.id)}
                      onChange={() => toggleQuote(item.id)}
                    />
                  </td>
                  <td>{quoteLabel(item)}</td>
                  <td>{item.quoteDate}</td>
                  <td className="amount">RM {Number(item.totalAmount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel no-print">
        <h3>2. 作业单抬头</h3>
        <div className="grid-form">
          <label>
            日期
            <input
              type="date"
              value={toDateInputValue(header.quoteDate)}
              onChange={(e) =>
                setHeader({ ...header, quoteDate: fromDateInputValue(e.target.value, 'both') })
              }
            />
          </label>
          <label>
            客户
            <input
              value={header.customerName}
              onChange={(e) => setHeader({ ...header, customerName: e.target.value })}
            />
          </label>
          <label className="span-2">
            地址
            <input
              value={header.address}
              onChange={(e) => setHeader({ ...header, address: e.target.value })}
            />
          </label>
          <label>
            联系方式
            <input
              value={header.contact}
              onChange={(e) => setHeader({ ...header, contact: e.target.value })}
            />
          </label>
          <label>
            作业单名称
            <input
              value={header.name}
              onChange={(e) => setHeader({ ...header, name: e.target.value })}
              placeholder="例如：本周合并下料"
            />
          </label>
          <label>
            尺寸单位
            <select
              value={header.measureUnit}
              onChange={(e) =>
                setHeader({ ...header, measureUnit: e.target.value as MeasureUnit })
              }
            >
              {MEASURE_UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel no-print">
        <div className="page-head">
          <h3>3. 合并明细（{lines.length} 行）</h3>
          <div className="row">
            <button type="button" className="secondary" onClick={addBlankLine}>
              + 手工加行
            </button>
            <button type="button" className="secondary" onClick={clearDraft}>
              清空草稿
            </button>
          </div>
        </div>
        <div className="work-order-actions" style={{ marginBottom: '0.75rem' }}>
          <span className="muted">已勾选 {selectedRows.size} 行</span>
          <button type="button" className="secondary" onClick={() => makeWorkOrder('brand')}>
            制作品牌报单
          </button>
          <button type="button" className="secondary" onClick={() => makeWorkOrder('fabric')}>
            制作下料单
          </button>
          <button type="button" className="secondary" onClick={() => makeWorkOrder('factory')}>
            制作工厂制作单
          </button>
        </div>
        <div className="table-scroll">
          <table className="edit-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={lines.length > 0 && selectedRows.size === lines.length}
                    onChange={toggleSelectAllRows}
                  />
                </th>
                <th>#</th>
                <th>来源</th>
                <th>楼层</th>
                <th>区域</th>
                <th>类型</th>
                <th>型号</th>
                <th>货源</th>
                <th>窗帘方式</th>
                <th>安装方式</th>
                <th>{labels.widthLabel}</th>
                <th>{labels.heightLabel}</th>
                <th>{labels.areaLabel}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={14}>
                    <div className="empty-state">
                      <strong>草稿为空</strong>
                      上方勾选报价单点「导入」，或点「手工加行」
                    </div>
                  </td>
                </tr>
              )}
              {lines.map((it, index) => (
                <tr key={index}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(index)}
                      onChange={() => toggleRow(index)}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      value={it.fromQuote || ''}
                      onChange={(e) => updateLine(index, { fromQuote: e.target.value })}
                      title="来源报价"
                    />
                  </td>
                  <td>
                    <select
                      value={
                        !it.floor || FLOOR_PRESETS.includes(it.floor)
                          ? it.floor
                          : `__other__:${it.floor}`
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v.startsWith('__other__:')) return;
                        updateLine(index, { floor: v });
                      }}
                    >
                      <option value="">（空）</option>
                      {FLOOR_PRESETS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                      {it.floor && !FLOOR_PRESETS.includes(it.floor) ? (
                        <option value={`__other__:${it.floor}`}>{it.floor}</option>
                      ) : null}
                    </select>
                  </td>
                  <td>
                    <input
                      value={it.area}
                      onChange={(e) => updateLine(index, { area: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={it.type}
                      onChange={(e) => updateLine(index, { type: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={it.model}
                      onChange={(e) => updateLine(index, { model: e.target.value })}
                    />
                  </td>
                  <td className="col-source">
                    <div className="source-cell">
                      <select
                        value={normalizeItemSource(it.source)}
                        onChange={(e) => {
                          const source = e.target.value as ItemSource;
                          updateLine(index, {
                            source,
                            brandName: source === 'brand' ? it.brandName || '' : '',
                          });
                        }}
                      >
                        {ITEM_SOURCE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {normalizeItemSource(it.source) === 'brand' ? (
                        <input
                          value={it.brandName || ''}
                          onChange={(e) => updateLine(index, { brandName: e.target.value })}
                          placeholder="品牌名"
                        />
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <input
                      value={it.openStyle}
                      onChange={(e) => updateLine(index, { openStyle: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={it.installMethod}
                      onChange={(e) => updateLine(index, { installMethod: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={it.width || ''}
                      onChange={(e) => updateLine(index, { width: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={it.height || ''}
                      onChange={(e) => updateLine(index, { height: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={it.sqm || ''}
                      onChange={(e) => updateLine(index, { sqm: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <button type="button" className="link danger" onClick={() => removeLine(index)}>
                      删
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {workOrder && (
        <section className="panel no-print">
          <div className="page-head">
            <h3>{WORK_ORDER_LABELS[workOrder.kind]}预览</h3>
            <div className="work-order-actions">
              <button type="button" onClick={handlePrint}>
                打印
              </button>
              <button type="button" className="secondary" onClick={handleImage}>
                出图
              </button>
              <button type="button" className="secondary" onClick={() => setWorkOrder(null)}>
                关闭
              </button>
            </div>
          </div>
          <div className="preview-wrap" ref={workOrderRef}>
            <WorkOrderPreview
              kind={workOrder.kind}
              quote={previewQuote}
              items={workOrder.items}
              showFromQuote
            />
          </div>
        </section>
      )}

      <div className="print-only">
        {workOrder ? (
          <WorkOrderPreview
            kind={workOrder.kind}
            quote={previewQuote}
            items={workOrder.items}
            showFromQuote
          />
        ) : null}
      </div>
    </div>
  );
}
