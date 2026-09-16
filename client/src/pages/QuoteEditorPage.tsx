import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ModelAutocomplete } from '../components/ModelAutocomplete';
import { OptionAutocomplete } from '../components/OptionAutocomplete';
import { QuotePreview } from '../components/QuotePreview';
import { WorkOrderPreview } from '../components/WorkOrderPreview';
import { exportImage } from '../exports/image';
import { printQuote } from '../exports/print';
import { exportTable, type TableExportFormat } from '../exports/table';
import {
  DICT_CATEGORY_LABELS,
  FLOOR_PRESETS,
  ITEM_SOURCE_OPTIONS,
  WORK_ORDER_LABELS,
  calcItem,
  calcItemsSubtotal,
  calcTotal,
  calcBalance,
  emptyCustomFee,
  emptyItem,
  emptyQuote,
  filterItemsForWorkOrder,
  normalizeItemSource,
  normalizeBrandName,
  todayDateStr,
  type CustomFee,
  type Customer,
  type DictCategory,
  type DictOption,
  type ItemSource,
  type MeasureUnit,
  type PageOrientation,
  type Product,
  type Quote,
  type QuoteItem,
  type QuoteLanguage,
  type WorkOrderKind,
  PAGE_ORIENTATION_OPTIONS,
} from '../types';
import {
  MEASURE_UNIT_OPTIONS,
  getMeasureLabels,
} from '../lib/units';
import { LANGUAGE_OPTIONS, getQuoteI18n, mergeOptionValueMap } from '../lib/i18n';
import {
  applyQuoteTranslation,
  collectTranslatableTexts,
  fromDateInputValue,
  localizeDateToChinese,
  localizeDateToEnglish,
  toDateInputValue,
} from '../lib/translateQuote';

export function QuoteEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [quote, setQuote] = useState<Quote>(emptyQuote());
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [tableMenu, setTableMenu] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPick, setCustomerPick] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set());
  const [workOrder, setWorkOrder] = useState<{
    kind: WorkOrderKind;
    items: QuoteItem[];
  } | null>(null);
  const [pendingModel, setPendingModel] = useState<{
    code: string;
    rowIndex: number;
    type: string;
    unitPrice: number;
    openStyle: string;
    installMethod: string;
  } | null>(null);
  const [pendingOption, setPendingOption] = useState<{
    category: DictCategory;
    label: string;
    labelEn: string;
    rowIndex: number;
  } | null>(null);
  const [typeOptions, setTypeOptions] = useState<DictOption[]>([]);
  const [openOptions, setOpenOptions] = useState<DictOption[]>([]);
  const [installOptions, setInstallOptions] = useState<DictOption[]>([]);
  const askedModels = useRef<Set<string>>(new Set());
  const askedOptions = useRef<Set<string>>(new Set());
  const previewRef = useRef<HTMLDivElement>(null);
  const workOrderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNew) return;
    setQuote((q) => ({ ...q, quoteDate: todayDateStr() }));
  }, [isNew]);

  useEffect(() => {
    api
      .listCustomers('', false)
      .then(({ items }) => setCustomers(items))
      .catch(() => {
        /* ignore */
      });
  }, []);

  function applyCustomer(idStr: string) {
    setCustomerPick(idStr);
    const c = customers.find((x) => String(x.id) === idStr);
    if (!c) return;
    setQuote((q) => ({
      ...q,
      customerName: c.name,
      contact: c.contact || q.contact,
      address: c.address || q.address,
    }));
  }

  useEffect(() => {
    Promise.all([
      api.listOptions('type'),
      api.listOptions('open_style'),
      api.listOptions('install_method'),
    ])
      .then(([t, o, i]) => {
        setTypeOptions(t.items);
        setOpenOptions(o.items);
        setInstallOptions(i.items);
        mergeOptionValueMap([...t.items, ...o.items, ...i.items]);
      })
      .catch(() => {
        /* keep empty — user can still type */
      });
  }, []);

  useEffect(() => {
    if (isNew) return;
    api
      .getQuote(Number(id))
      .then(({ item }) =>
        setQuote({
          ...item,
          name: item.name || '',
          depositPrevious: Number(item.depositPrevious) || 0,
          depositCurrent: Number(item.depositCurrent) || 0,
          pageOrientation: item.pageOrientation === 'landscape' ? 'landscape' : 'portrait',
          measureUnit: item.measureUnit === 'ft' ? 'ft' : 'm',
          customFees: Array.isArray(item.customFees) ? item.customFees : [],
          customFeeNotes:
            Array.isArray(item.customFeeNotes) && item.customFeeNotes.length
              ? item.customFeeNotes
              : [''],
          language:
            item.language === 'zh' || item.language === 'en' || item.language === 'both'
              ? item.language
              : 'both',
          items: (item.items.length ? item.items : [emptyItem()]).map((it) => {
            const source = normalizeItemSource(it.source);
            return {
              ...it,
              source,
              brandName: normalizeBrandName(source, it.brandName),
            };
          }),
        }),
      )
      .catch((e) => setError(e.message));
  }, [id, isNew]);

  // 明细行数变化时校正勾选
  useEffect(() => {
    setSelectedRows((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < quote.items.length) next.add(i);
      }
      return next;
    });
  }, [quote.items.length]);

  const itemsSubtotal = useMemo(() => calcItemsSubtotal(quote.items), [quote.items]);
  const total = useMemo(
    () => calcTotal(quote.items, quote.customFees || []),
    [quote.items, quote.customFees],
  );
  const unit = (quote.measureUnit || 'm') as MeasureUnit;
  const labels = getMeasureLabels(unit);

  function updateItem(index: number, patch: Partial<QuoteItem>) {
    setQuote((q) => {
      const items = q.items.map((it, i) => {
        if (i !== index) return it;
        const next = { ...it, ...patch };
        if (
          next.type.includes('百叶') &&
          'sqm' in patch &&
          !('width' in patch) &&
          !('height' in patch)
        ) {
          const sqm = Math.round((Number(patch.sqm) || 0) * 100) / 100;
          const unitPrice = Number(next.unitPrice) || 0;
          return {
            ...next,
            sqm,
            amount: Math.round(sqm * unitPrice * 100) / 100,
          };
        }
        return calcItem(next);
      });
      return { ...q, items, totalAmount: calcTotal(items, q.customFees || []) };
    });
  }

  function addRow() {
    setQuote((q) => {
      const items = [...q.items, emptyItem()];
      return { ...q, items, totalAmount: calcTotal(items, q.customFees || []) };
    });
  }

  function removeRow(index: number) {
    setQuote((q) => {
      const items = q.items.filter((_, i) => i !== index);
      const next = items.length ? items : [emptyItem()];
      return { ...q, items: next, totalAmount: calcTotal(next, q.customFees || []) };
    });
    setSelectedRows((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i === index) continue;
        next.add(i > index ? i - 1 : i);
      }
      return next;
    });
  }

  function toggleRowSelected(index: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedRows((prev) => {
      if (prev.size === quote.items.length) return new Set();
      return new Set(quote.items.map((_, i) => i));
    });
  }

  function makeWorkOrder(kind: WorkOrderKind) {
    setError('');
    setMsg('');
    if (selectedRows.size === 0) {
      setError('请先勾选要导出的明细行');
      return;
    }
    const items = filterItemsForWorkOrder(quote.items, [...selectedRows], kind);
    if (items.length === 0) {
      const tip =
        kind === 'brand'
          ? '勾选行中没有「品牌」货源，请先改货源或改选行'
          : kind === 'fabric'
            ? '勾选行中没有「自有」货源，请先改货源或改选行'
            : '没有可用明细行';
      setError(tip);
      return;
    }
    setWorkOrder({ kind, items });
    setMsg(`已生成${WORK_ORDER_LABELS[kind]}（${items.length} 行），可预览 / 打印 / 出图`);
  }

  async function handleWorkOrderPrint() {
    if (!workOrder) return;
    requestAnimationFrame(() =>
      printQuote(quote.pageOrientation === 'landscape' ? 'landscape' : 'portrait'),
    );
  }

  async function handleWorkOrderImage() {
    if (!workOrder) return;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const el = workOrderRef.current?.querySelector('.quote-sheet') as HTMLElement | null;
    if (!el) {
      setError('作业单预览未就绪');
      return;
    }
    try {
      await exportImage(el, {
        ...quote,
        customerName: `${quote.customerName || '作业单'}-${WORK_ORDER_LABELS[workOrder.kind]}`,
        totalAmount: total,
      });
      setMsg(`${WORK_ORDER_LABELS[workOrder.kind]}图片已导出`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '出图失败');
    }
  }

  function updateCustomFee(index: number, patch: Partial<CustomFee>) {
    setQuote((q) => {
      const customFees = (q.customFees || []).map((f, i) =>
        i === index ? { ...f, ...patch } : f,
      );
      return { ...q, customFees, totalAmount: calcTotal(q.items, customFees) };
    });
  }

  function addCustomFee() {
    setQuote((q) => {
      const customFees = [...(q.customFees || []), emptyCustomFee()];
      return {
        ...q,
        customFees,
        totalAmount: calcTotal(q.items, customFees),
      };
    });
  }

  function removeCustomFee(index: number) {
    setQuote((q) => {
      const customFees = (q.customFees || []).filter((_, i) => i !== index);
      return { ...q, customFees, totalAmount: calcTotal(q.items, customFees) };
    });
  }

  function updateCustomFeeNote(index: number, value: string) {
    setQuote((q) => {
      const customFeeNotes = [...(q.customFeeNotes || [''])];
      customFeeNotes[index] = value;
      return { ...q, customFeeNotes };
    });
  }

  function addCustomFeeNote() {
    setQuote((q) => ({
      ...q,
      customFeeNotes: [...(q.customFeeNotes || []), ''],
    }));
  }

  function removeCustomFeeNote(index: number) {
    setQuote((q) => {
      const next = (q.customFeeNotes || []).filter((_, i) => i !== index);
      return { ...q, customFeeNotes: next.length ? next : [''] };
    });
  }

  function changeLanguage(nextLang: QuoteLanguage) {
    setQuote((q) => {
      const prev = getQuoteI18n(q.language || 'both');
      const next = getQuoteI18n(nextLang);
      const patch: Partial<Quote> = { language: nextLang };

      // 若标题/说明仍是默认文案，随语言切换自动替换
      if (
        !q.title ||
        q.title === prev.defaultTitle ||
        q.title === 'JINCHAN CURTAIN QTN [金蝉窗帘报价单]' ||
        q.title === 'JINCHAN CURTAIN QTN' ||
        q.title === '金蝉窗帘报价单'
      ) {
        patch.title = next.defaultTitle;
      }
      if (
        !q.otherNotes.trim() ||
        q.otherNotes === prev.defaultNotes ||
        q.otherNotes.includes('尺寸以实际测量为准') ||
        q.otherNotes.includes('Dimensions are subject')
      ) {
        patch.otherNotes = next.defaultNotes;
      }

      // 日期格式随语言切换
      if (nextLang === 'en') {
        patch.quoteDate = localizeDateToEnglish(q.quoteDate);
      } else if (nextLang === 'zh') {
        patch.quoteDate = localizeDateToChinese(q.quoteDate);
      }

      return { ...q, ...patch };
    });
  }

  function applyProduct(index: number, p: Product) {
    const source = normalizeItemSource(p.source);
    updateItem(index, {
      model: p.code,
      type: p.type || '布',
      unitPrice: p.defaultUnitPrice,
      openStyle: p.defaultOpenStyle || quote.items[index].openStyle,
      installMethod: p.defaultInstallMethod || quote.items[index].installMethod,
      source,
      brandName: normalizeBrandName(source, p.brandName),
    });
    askedModels.current.add(p.code.toLowerCase());
  }

  function handleUnknownModel(index: number, code: string) {
    if (!isAdmin) return;
    const key = code.toLowerCase();
    if (askedModels.current.has(key)) return;
    askedModels.current.add(key);
    const row = quote.items[index];
    setPendingModel({
      code,
      rowIndex: index,
      type: row.type,
      unitPrice: row.unitPrice,
      openStyle: row.openStyle,
      installMethod: row.installMethod,
    });
  }

  async function confirmAddToLibrary() {
    if (!pendingModel) return;
    if (!isAdmin) {
      setError('需要管理员权限才能加入型号库');
      setPendingModel(null);
      return;
    }
    try {
      await api.createProduct({
        code: pendingModel.code,
        type: pendingModel.type,
        defaultUnitPrice: pendingModel.unitPrice,
        defaultOpenStyle: pendingModel.openStyle,
        defaultInstallMethod: pendingModel.installMethod,
        note: '由报价单自动加入',
        source: normalizeItemSource(quote.items[pendingModel.rowIndex]?.source),
        brandName: normalizeBrandName(
          normalizeItemSource(quote.items[pendingModel.rowIndex]?.source),
          quote.items[pendingModel.rowIndex]?.brandName,
        ),
        enabled: true,
      });
      setMsg(`已将型号 ${pendingModel.code} 加入型号库`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入型号库失败');
    } finally {
      setPendingModel(null);
    }
  }

  function handleUnknownOption(category: DictCategory, index: number, label: string) {
    if (!isAdmin) return;
    const key = `${category}:${label}`;
    if (askedOptions.current.has(key)) return;
    askedOptions.current.add(key);
    setPendingOption({ category, label, labelEn: '', rowIndex: index });
  }

  async function confirmAddOption() {
    if (!pendingOption) return;
    if (!isAdmin) {
      setError('需要管理员权限才能加入选项库');
      setPendingOption(null);
      return;
    }
    try {
      const { item } = await api.createOption({
        category: pendingOption.category,
        label: pendingOption.label,
        labelEn: pendingOption.labelEn.trim(),
      });
      if (pendingOption.category === 'type') {
        setTypeOptions((list) => [...list, item]);
      } else if (pendingOption.category === 'open_style') {
        setOpenOptions((list) => [...list, item]);
      } else {
        setInstallOptions((list) => [...list, item]);
      }
      mergeOptionValueMap([item]);
      setMsg(
        pendingOption.labelEn.trim()
          ? `已将「${pendingOption.label}」加入${DICT_CATEGORY_LABELS[pendingOption.category]}`
          : `已加入「${pendingOption.label}」（英文可稍后在选项库里补）`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入选项库失败');
    } finally {
      setPendingOption(null);
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const body = { ...quote, totalAmount: total };
      if (isNew) {
        const { item } = await api.createQuote(body);
        setMsg('已保存');
        navigate(`/quotes/${item.id}`, { replace: true });
      } else {
        const { item } = await api.updateQuote(Number(id), body);
        setQuote({ ...item, items: item.items.length ? item.items : [emptyItem()] });
        setMsg('已保存');
      }
      if (quote.customerName.trim()) {
        api
          .listCustomers('', false)
          .then(({ items }) => setCustomers(items))
          .catch(() => {
            /* ignore */
          });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleTranslateToEnglish() {
    if (
      !confirm(
        '将把当前填写的中文内容翻译成英文，并切换为英文报价单。\n（类型/开合/安装等选项会自动显示英文）\n是否继续？',
      )
    ) {
      return;
    }
    setTranslating(true);
    setError('');
    setMsg('');
    try {
      const texts = collectTranslatableTexts(quote);
      let translations: Record<string, string> = {};
      if (texts.length > 0) {
        const res = await api.translate(texts);
        translations = res.translations || {};
      }
      const next = applyQuoteTranslation(quote, translations);
      setQuote({ ...next, totalAmount: total });
      setShowPreview(true);
      setMsg(
        texts.length
          ? `已翻译 ${Object.keys(translations).length} 段内容，并切换为英文`
          : '已切换为英文（无需调用翻译接口）',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '翻译失败');
    } finally {
      setTranslating(false);
    }
  }

  /** Three independent export entry points */
  function handlePrint() {
    setWorkOrder(null);
    setShowPreview(true);
    requestAnimationFrame(() =>
      printQuote(quote.pageOrientation === 'landscape' ? 'landscape' : 'portrait'),
    );
  }

  function handleExportTable(format: TableExportFormat) {
    setTableMenu(false);
    exportTable({ ...quote, totalAmount: total }, format);
  }

  async function handleExportImage() {
    setShowPreview(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const el = previewRef.current?.querySelector('.quote-sheet') as HTMLElement | null;
    if (!el) {
      setError('预览未就绪，请先打开预览再出图');
      return;
    }
    try {
      await exportImage(el, { ...quote, totalAmount: total });
      setMsg('图片已导出');
    } catch (err) {
      setError(err instanceof Error ? err.message : '出图失败');
    }
  }

  return (
    <div className="page quote-editor">
      <div className="page-head page-head--toolbar no-print">
        <Link className="back-link" to="/quotes">
          ← 返回列表
        </Link>
        <div className="toolbar">
          <div className="toolbar-group">
            <button type="button" className="secondary" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? '隐藏预览' : '预览'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={translating}
              onClick={handleTranslateToEnglish}
              title="使用免费翻译接口，将填写的中文译成英文"
            >
              {translating ? '翻译中…' : '一键译成英文'}
            </button>
          </div>
          <div className="toolbar-group">
            <button type="button" onClick={handlePrint}>
              打印
            </button>
            <div className="menu-wrap">
              <button type="button" className="secondary" onClick={() => setTableMenu((v) => !v)}>
                出表格 ▾
              </button>
              {tableMenu && (
                <div className="menu">
                  <button type="button" onClick={() => handleExportTable('xlsx')}>
                    Excel (.xlsx)
                  </button>
                  <button type="button" onClick={() => handleExportTable('csv')}>
                    CSV (.csv)
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="secondary" onClick={handleExportImage}>
              出图
            </button>
          </div>
          <div className="toolbar-group">
            <button type="button" disabled={saving} onClick={save}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error no-print">{error}</div>}
      {msg && <div className="ok no-print">{msg}</div>}

      <section className="panel no-print">
        <h3>抬头信息</h3>
        <div className="grid-form">
          <label className="span-2">
            报价单名称
            <input
              value={quote.name || ''}
              onChange={(e) => setQuote({ ...quote, name: e.target.value })}
              placeholder="例如：张先生 · 客厅 / 某某小区 3 号楼"
            />
            <span className="hint">用于列表快速查找，不会打印到报价单上</span>
          </label>
          <label className="span-2">
            打印标题
            <input
              value={quote.title}
              onChange={(e) => setQuote({ ...quote, title: e.target.value })}
            />
          </label>
          <label>
            日期
            <input
              type="date"
              value={toDateInputValue(quote.quoteDate)}
              onChange={(e) =>
                setQuote({
                  ...quote,
                  quoteDate: fromDateInputValue(e.target.value, quote.language || 'both'),
                })
              }
              title="使用系统日期选择器"
            />
          </label>
          <label>
            客户
            <input
              value={quote.customerName}
              onChange={(e) => {
                setCustomerPick('');
                setQuote({ ...quote, customerName: e.target.value });
              }}
              list="customer-name-suggestions"
              placeholder="输入或从客户库选择"
            />
            <datalist id="customer-name-suggestions">
              {customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </label>
          <label>
            从客户库填入
            <select value={customerPick} onChange={(e) => applyCustomer(e.target.value)}>
              <option value="">选择已有客户…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.contact ? ` · ${c.contact}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            地址
            <input
              value={quote.address}
              onChange={(e) => setQuote({ ...quote, address: e.target.value })}
            />
          </label>
          <label>
            联系方式
            <input
              value={quote.contact}
              onChange={(e) => setQuote({ ...quote, contact: e.target.value })}
            />
          </label>
          <label>
            尺寸单位预设
            <select
              value={unit}
              onChange={(e) =>
                setQuote({ ...quote, measureUnit: e.target.value as MeasureUnit })
              }
            >
              {MEASURE_UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            报价单语言
            <select
              value={quote.language || 'both'}
              onChange={(e) => changeLanguage(e.target.value as QuoteLanguage)}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            打印版面
            <select
              value={quote.pageOrientation === 'landscape' ? 'landscape' : 'portrait'}
              onChange={(e) =>
                setQuote({
                  ...quote,
                  pageOrientation: e.target.value as PageOrientation,
                })
              }
            >
              {PAGE_ORIENTATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          中文 / English / 中英双语会切换预览、打印、导出的表头与固定文案。
          也可点工具栏「一键译成英文」把填写内容翻成英文（免费接口，有每日额度限制）。
        </p>
      </section>

      <section className="panel no-print">
        <div className="page-head">
          <h3>明细行</h3>
          <div className="row">
            <span className="muted">当前：{labels.label}</span>
            <button type="button" className="secondary" onClick={addRow}>
              + 添加行
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
                    checked={quote.items.length > 0 && selectedRows.size === quote.items.length}
                    onChange={toggleSelectAll}
                    title="全选"
                    aria-label="全选"
                  />
                </th>
                <th>#</th>
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
                <th>单价</th>
                <th>金额</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {quote.items.map((it, index) => (
                <tr key={index}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(index)}
                      onChange={() => toggleRowSelected(index)}
                      aria-label={`选择第 ${index + 1} 行`}
                    />
                  </td>
                  <td>{index + 1}</td>
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
                        updateItem(index, { floor: v });
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
                      onChange={(e) => updateItem(index, { area: e.target.value })}
                    />
                  </td>
                  <td>
                    <OptionAutocomplete
                      category="type"
                      value={it.type}
                      placeholder="类型"
                      options={typeOptions}
                      onChange={(type) => updateItem(index, { type })}
                      onUnknown={(label) => handleUnknownOption('type', index, label)}
                    />
                  </td>
                  <td>
                    <ModelAutocomplete
                      value={it.model}
                      onChange={(model) => updateItem(index, { model })}
                      onPickProduct={(p) => applyProduct(index, p)}
                      onUnknownModel={(code) => handleUnknownModel(index, code)}
                    />
                  </td>
                  <td className="col-source">
                    <div className="source-cell">
                      <select
                        value={normalizeItemSource(it.source)}
                        onChange={(e) => {
                          const source = e.target.value as ItemSource;
                          updateItem(index, {
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
                          onChange={(e) => updateItem(index, { brandName: e.target.value })}
                          placeholder="品牌名"
                          title="具体品牌"
                        />
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <OptionAutocomplete
                      category="open_style"
                      value={it.openStyle}
                      placeholder="窗帘方式"
                      options={openOptions}
                      onChange={(openStyle) => updateItem(index, { openStyle })}
                      onUnknown={(label) => handleUnknownOption('open_style', index, label)}
                    />
                  </td>
                  <td>
                    <OptionAutocomplete
                      category="install_method"
                      value={it.installMethod}
                      placeholder="安装方式"
                      options={installOptions}
                      onChange={(installMethod) => updateItem(index, { installMethod })}
                      onUnknown={(label) =>
                        handleUnknownOption('install_method', index, label)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={it.width || ''}
                      onChange={(e) => updateItem(index, { width: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={it.height || ''}
                      onChange={(e) => updateItem(index, { height: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    {it.type.includes('百叶') ? (
                      <input
                        type="number"
                        step="0.01"
                        value={it.sqm || ''}
                        onChange={(e) => updateItem(index, { sqm: Number(e.target.value) })}
                        title="有宽高时自动计算；也可直接填写平方"
                      />
                    ) : (
                      <span className="readonly">{it.sqm || ''}</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={it.unitPrice || ''}
                      onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
                    />
                  </td>
                  <td className="readonly">{it.amount || ''}</td>
                  <td>
                    <button type="button" className="link danger" onClick={() => removeRow(index)}>
                      删
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="total-line">
          <span>明细小计：RM {itemsSubtotal}</span>
          {(quote.customFees || [])
            .filter((f) => f.name.trim() || f.amount)
            .map((fee, i) => (
              <span key={i}>
                {fee.name.trim() || '未命名费用'}：RM {fee.amount || 0}
              </span>
            ))}
          <strong className="grand">总金额：RM {total}</strong>
        </div>
      </section>

      <section className="panel no-print">
        <div className="page-head">
          <h3>自定义费用</h3>
          <button type="button" className="secondary" onClick={addCustomFee}>
            + 添加费用
          </button>
        </div>
        <p className="muted">可添加运费、加急费等，金额会计入总价</p>
        {(quote.customFees || []).length === 0 ? (
          <p className="muted">暂无自定义费用</p>
        ) : (
          <table className="data-table fee-edit-table">
            <thead>
              <tr>
                <th>费用名称</th>
                <th style={{ width: 160 }}>金额 (RM)</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {(quote.customFees || []).map((fee, index) => (
                <tr key={index}>
                  <td>
                    <input
                      placeholder="例如：运费 / 加急费"
                      value={fee.name}
                      onChange={(e) => updateCustomFee(index, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={fee.amount || ''}
                      onChange={(e) =>
                        updateCustomFee(index, { amount: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link danger"
                      onClick={() => removeCustomFee(index)}
                    >
                      删
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel no-print">
        <h3>订金 / 尾款</h3>
        <div className="grid-form">
          <label>
            之前预收订金 (RM)
            <input
              type="number"
              step="0.01"
              value={quote.depositPrevious || 0}
              onChange={(e) =>
                setQuote({ ...quote, depositPrevious: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label>
            本次收定金 (RM)
            <input
              type="number"
              step="0.01"
              value={quote.depositCurrent || 0}
              onChange={(e) =>
                setQuote({ ...quote, depositCurrent: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label>
            剩余尾款 (自动)
            <input
              readOnly
              className="readonly-field"
              value={calcBalance(total, quote.depositPrevious || 0, quote.depositCurrent || 0)}
            />
          </label>
        </div>
        <p className="hint">尾款 = 总金额 − 之前预收 − 本次定金；打印在明细表下方</p>
      </section>

      <section className="panel no-print">
        <h3>费用包含 / 说明</h3>
        <div className="fee-checks">
          {(
            [
              ['includeMeasure', '测量费用'],
              ['includeProduce', '制作费用'],
              ['includeInstall', '安装费用'],
              ['includeHeat', '高温定型费用'],
              ['includeOther', '其他费用'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={quote[key]}
                onChange={(e) => setQuote({ ...quote, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="fee-note-fields fee-note-fields--stack">
          <div className="custom-fee-notes">
            <div className="page-head">
              <strong>自定义费用说明</strong>
              <button type="button" className="secondary" onClick={addCustomFeeNote}>
                + 添加说明
              </button>
            </div>
            {(quote.customFeeNotes || ['']).map((note, index) => (
              <div className="row fee-note-row" key={index}>
                <input
                  placeholder="填写说明内容，预览中只显示这段文字"
                  value={note}
                  onChange={(e) => updateCustomFeeNote(index, e.target.value)}
                />
                <button
                  type="button"
                  className="link danger"
                  onClick={() => removeCustomFeeNote(index)}
                >
                  删
                </button>
              </div>
            ))}
          </div>
          <label>
            其他费用说明
            <input
              placeholder="其他费用备注"
              value={quote.otherFeeNote}
              onChange={(e) => setQuote({ ...quote, otherFeeNote: e.target.value })}
            />
          </label>
        </div>
        <label>
          备注
          <textarea
            rows={3}
            value={quote.otherNotes}
            onChange={(e) => setQuote({ ...quote, otherNotes: e.target.value })}
            placeholder="例如：罗马杆型材… 轨道型材…"
          />
        </label>
      </section>

      {workOrder && (
        <section className="panel no-print">
          <div className="page-head">
            <h3>{WORK_ORDER_LABELS[workOrder.kind]}预览</h3>
            <div className="work-order-actions">
              <button type="button" onClick={handleWorkOrderPrint}>
                打印
              </button>
              <button type="button" className="secondary" onClick={handleWorkOrderImage}>
                出图
              </button>
              <button type="button" className="secondary" onClick={() => setWorkOrder(null)}>
                关闭
              </button>
            </div>
          </div>
          <div className="preview-wrap" ref={workOrderRef}>
            <WorkOrderPreview kind={workOrder.kind} quote={quote} items={workOrder.items} />
          </div>
        </section>
      )}

      {showPreview && (
        <div className="preview-wrap" ref={previewRef}>
          <QuotePreview quote={{ ...quote, totalAmount: total }} />
        </div>
      )}

      {/* Hidden print root：有作业单时优先打作业单，否则打报价单 */}
      <div className="print-only">
        {workOrder ? (
          <WorkOrderPreview kind={workOrder.kind} quote={quote} items={workOrder.items} />
        ) : (
          <QuotePreview quote={{ ...quote, totalAmount: total }} />
        )}
      </div>

      {pendingModel && (
        <div className="modal-backdrop no-print">
          <div className="modal">
            <h3>加入型号库？</h3>
            <p>
              型号 <strong>{pendingModel.code}</strong> 不在型号库中，是否加入？
            </p>
            <p className="muted">
              将使用本行类型「{pendingModel.type}」、单价 {pendingModel.unitPrice}
            </p>
            <div className="row">
              <button type="button" onClick={confirmAddToLibrary}>
                加入型号库
              </button>
              <button type="button" className="secondary" onClick={() => setPendingModel(null)}>
                仅本单使用
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingOption && (
        <div className="modal-backdrop no-print">
          <div className="modal">
            <h3>加入选项库？</h3>
            <p>
              {DICT_CATEGORY_LABELS[pendingOption.category]}「
              <strong>{pendingOption.label}</strong>」不在选项库中，是否加入？
            </p>
            <label style={{ display: 'block', margin: '0.75rem 0' }}>
              英文名称（可选，英文/双语报价单会用到）
              <div className="row" style={{ marginTop: '0.35rem', alignItems: 'stretch', gap: '0.5rem' }}>
                <input
                  value={pendingOption.labelEn}
                  onChange={(e) =>
                    setPendingOption({ ...pendingOption, labelEn: e.target.value })
                  }
                  placeholder="例如：Shangri-La"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={async () => {
                    try {
                      const text = pendingOption.label.trim();
                      if (!text) return;
                      const { translations } = await api.translate([text]);
                      const en = (translations[text] || Object.values(translations)[0] || '').trim();
                      if (en) setPendingOption({ ...pendingOption, labelEn: en });
                      else setError('翻译结果为空');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : '翻译失败');
                    }
                  }}
                >
                  一键翻译
                </button>
              </div>
            </label>
            <p className="muted">不填也可以，之后在「选项库」点编辑补上。</p>
            <div className="row">
              <button type="button" onClick={confirmAddOption}>
                加入选项库
              </button>
              <button type="button" className="secondary" onClick={() => setPendingOption(null)}>
                仅本单使用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
