import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { ModelAutocomplete } from '../components/ModelAutocomplete';
import { OptionAutocomplete } from '../components/OptionAutocomplete';
import { QuotePreview } from '../components/QuotePreview';
import { exportImage } from '../exports/image';
import { printQuote } from '../exports/print';
import { exportTable, type TableExportFormat } from '../exports/table';
import {
  DICT_CATEGORY_LABELS,
  calcItem,
  calcItemsSubtotal,
  calcTotal,
  calcBalance,
  emptyCustomFee,
  emptyItem,
  emptyQuote,
  type CustomFee,
  type DictCategory,
  type DictOption,
  type MeasureUnit,
  type PageOrientation,
  type Product,
  type Quote,
  type QuoteItem,
  type QuoteLanguage,
  PAGE_ORIENTATION_OPTIONS,
} from '../types';
import {
  AREA_PRESETS,
  MEASURE_UNIT_OPTIONS,
  WIDTH_HEIGHT_PRESETS,
  getMeasureLabels,
} from '../lib/units';
import { LANGUAGE_OPTIONS, getQuoteI18n, mergeOptionValueMap } from '../lib/i18n';
import {
  applyQuoteTranslation,
  collectTranslatableTexts,
  localizeDateToChinese,
  localizeDateToEnglish,
} from '../lib/translateQuote';

export function QuoteEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote>(emptyQuote());
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [tableMenu, setTableMenu] = useState(false);
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
    rowIndex: number;
  } | null>(null);
  const [typeOptions, setTypeOptions] = useState<DictOption[]>([]);
  const [openOptions, setOpenOptions] = useState<DictOption[]>([]);
  const [installOptions, setInstallOptions] = useState<DictOption[]>([]);
  const askedModels = useRef<Set<string>>(new Set());
  const askedOptions = useRef<Set<string>>(new Set());
  const previewRef = useRef<HTMLDivElement>(null);

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
          items: item.items.length ? item.items : [emptyItem()],
        }),
      )
      .catch((e) => setError(e.message));
  }, [id, isNew]);

  const itemsSubtotal = useMemo(() => calcItemsSubtotal(quote.items), [quote.items]);
  const total = useMemo(
    () => calcTotal(quote.items, quote.customFees || []),
    [quote.items, quote.customFees],
  );
  const unit = (quote.measureUnit || 'm') as MeasureUnit;
  const labels = getMeasureLabels(unit);
  const sizePresets = WIDTH_HEIGHT_PRESETS[unit];
  const areaPresets = AREA_PRESETS[unit];

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
    updateItem(index, {
      model: p.code,
      type: p.type || '布',
      unitPrice: p.defaultUnitPrice,
      openStyle: p.defaultOpenStyle || quote.items[index].openStyle,
      installMethod: p.defaultInstallMethod || quote.items[index].installMethod,
    });
    askedModels.current.add(p.code.toLowerCase());
  }

  function handleUnknownModel(index: number, code: string) {
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
    try {
      await api.createProduct({
        code: pendingModel.code,
        type: pendingModel.type,
        defaultUnitPrice: pendingModel.unitPrice,
        defaultOpenStyle: pendingModel.openStyle,
        defaultInstallMethod: pendingModel.installMethod,
        note: '由报价单自动加入',
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
    const key = `${category}:${label}`;
    if (askedOptions.current.has(key)) return;
    askedOptions.current.add(key);
    setPendingOption({ category, label, rowIndex: index });
  }

  async function confirmAddOption() {
    if (!pendingOption) return;
    try {
      const { item } = await api.createOption({
        category: pendingOption.category,
        label: pendingOption.label,
        labelEn: '',
      });
      if (pendingOption.category === 'type') {
        setTypeOptions((list) => [...list, item]);
      } else if (pendingOption.category === 'open_style') {
        setOpenOptions((list) => [...list, item]);
      } else {
        setInstallOptions((list) => [...list, item]);
      }
      mergeOptionValueMap([item]);
      setMsg(`已将「${pendingOption.label}」加入${DICT_CATEGORY_LABELS[pendingOption.category]}`);
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
              value={quote.quoteDate}
              onChange={(e) => setQuote({ ...quote, quoteDate: e.target.value })}
            />
          </label>
          <label>
            客户
            <input
              value={quote.customerName}
              onChange={(e) => setQuote({ ...quote, customerName: e.target.value })}
            />
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
            <span className="muted">当前：{labels.label}（输入框可点选常用预设）</span>
            <button type="button" className="secondary" onClick={addRow}>
              + 添加行
            </button>
          </div>
        </div>
        <datalist id="size-presets">
          {sizePresets.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <datalist id="area-presets">
          {areaPresets.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="table-scroll">
          <table className="edit-table">
            <thead>
              <tr>
                <th>#</th>
                <th>楼层</th>
                <th>区域</th>
                <th>类型</th>
                <th>型号</th>
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
                  <td>{index + 1}</td>
                  <td>
                    <input
                      value={it.floor}
                      onChange={(e) => updateItem(index, { floor: e.target.value })}
                    />
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
                      list="size-presets"
                      value={it.width || ''}
                      onChange={(e) => updateItem(index, { width: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      list="size-presets"
                      value={it.height || ''}
                      onChange={(e) => updateItem(index, { height: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    {it.type.includes('百叶') ? (
                      <input
                        type="number"
                        step="0.01"
                        list="area-presets"
                        value={it.sqm || ''}
                        onChange={(e) => updateItem(index, { sqm: Number(e.target.value) })}
                        title="有宽高时自动计算；也可直接选平方预设"
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

      {showPreview && (
        <div className="preview-wrap" ref={previewRef}>
          <QuotePreview quote={{ ...quote, totalAmount: total }} />
        </div>
      )}

      {/* Hidden print root always present for print CSS */}
      <div className="print-only">
        <QuotePreview quote={{ ...quote, totalAmount: total }} />
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
